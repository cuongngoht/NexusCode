import { AgentRegistry } from '../../application/AgentRegistry';
import { AgentRouter } from '../../application/AgentRouter';
import { RunAgentUseCase } from '../../application/usecases/RunAgentUseCase';
import { NexusOrchestrator } from '../../application/nexus/NexusOrchestrator';
import type { NexusStage } from '../../application/nexus/NexusRoutingPolicy';
import { EventBus } from '../../core/eventBus';
import type { NexusEvent } from '../../core/events/IEventBus';
import type { PipelineContext } from '../../core/pipeline/PipelineContext';
import type { TaskMode } from '../../core/agent/AgentTask';
import { ProcessRunner } from '../../runner/processRunner';
import { ClaudeAgent } from '../../providers/claude/ClaudeAgent';
import { CodexAgent } from '../../providers/codex/CodexAgent';
import { GeminiAgent } from '../../providers/gemini/GeminiAgent';
import { CopilotAgent } from '../../providers/copilot/CopilotAgent';
import { AiderAgent } from '../../providers/aider/AiderAgent';
import { CustomAgent } from '../../providers/custom/CustomAgent';
import { NexusAgent } from '../../providers/nexus/NexusAgent';
import * as fs from 'fs';
import * as path from 'path';

interface RunOptions {
  root: string;
  mode: string;
  provider: string;
  stage: string;
  plan?: string;
  baseBranch?: string;
  model?: string;
  prompt: string;
}

function buildCliCustomConfig(root: string) {
  const configPath = path.join(root, '.nexus', 'config.json');
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const cfg = JSON.parse(raw) as { customProvider?: { command?: string; args?: string[] } };
    return {
      getCommand: () => cfg.customProvider?.command ?? '',
      getArgs: () => cfg.customProvider?.args ?? ['{{prompt}}'],
    };
  } catch {
    return {
      getCommand: () => process.env['NEXUS_CUSTOM_COMMAND'] ?? '',
      getArgs: () => (process.env['NEXUS_CUSTOM_ARGS'] ?? '{{prompt}}').split(' '),
    };
  }
}

export async function runCommand(options: RunOptions): Promise<void> {
  const workspaceRoot = path.resolve(options.root);
  const mode = options.mode as TaskMode;
  const requestedStage = (options.stage as 'auto' | NexusStage) ?? 'auto';

  const registry = new AgentRegistry();
  registry.register(new ClaudeAgent());
  registry.register(new CodexAgent());
  registry.register(new GeminiAgent());
  registry.register(new CopilotAgent());
  registry.register(new AiderAgent());
  registry.register(new CustomAgent(buildCliCustomConfig(workspaceRoot)));
  registry.register(new NexusAgent());

  const eventBus = new EventBus();
  const runner = new ProcessRunner();
  const router = new AgentRouter(registry);
  const runUseCase = new RunAgentUseCase(router, runner, eventBus);
  const orchestrator = new NexusOrchestrator(registry, runUseCase, eventBus);

  let exitCode = 0;

  eventBus.on('*', (event: NexusEvent) => {
    switch (event.kind) {
      case 'stdout':
        process.stdout.write(event.chunk);
        break;
      case 'stderr':
        process.stderr.write(event.chunk);
        break;
      case 'step_started':
        process.stderr.write(`\nNexus stage: ${event.stepLabel} via ${event.provider}\n`);
        break;
      case 'step_error':
        process.stderr.write(`Nexus error in stage ${event.stepLabel}: ${event.error}\n`);
        break;
      case 'task_completed':
        if (event.result.exitCode !== 0) {
          exitCode = event.result.exitCode;
        }
        break;
      case 'task_error':
        process.stderr.write(`Task error: ${event.error}\n`);
        exitCode = 1;
        break;
    }
  });

  const ctx: PipelineContext = {
    workspaceRoot,
    originalPrompt: options.prompt,
    enhancedPrompt: options.prompt,
    mode,
    model: options.model,
    providerId: 'nexus',
    enableEnhancement: false,
  };

  try {
    await orchestrator.run(ctx, requestedStage);
  } catch (err) {
    process.stderr.write(`Nexus run failed: ${err}\n`);
    process.exit(1);
  }

  process.exit(exitCode);
}
