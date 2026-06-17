import { AgentRegistry } from '../../application/AgentRegistry';
import { AgentRouter } from '../../application/AgentRouter';
import { RunAgentUseCase } from '../../application/usecases/RunAgentUseCase';
import { NexusOrchestrator } from '../../application/nexus/NexusOrchestrator';
import type { NexusStage } from '../../application/nexus/NexusRoutingPolicy';
import { ModelRouter } from '../../application/routing/ModelRouter';
import { ProviderRouteExpressionParser } from '../../application/routing/ProviderRouteExpressionParser';
import { FallbackPolicy, DEFAULT_FALLBACK_POLICY_CONFIG } from '../../application/routing/FallbackPolicy';
import { ProviderFailureClassifier } from '../../application/routing/ProviderFailureClassifier';
import { EventBus } from '../../core/eventBus';
import type { NexusEvent } from '../../core/events/IEventBus';
import type { PipelineContext } from '../../core/pipeline/PipelineContext';
import type { TaskMode, AgentId } from '../../core/agent/AgentTask';
import { AgentTask } from '../../core/agent/AgentTask';
import { ProcessRunner } from '../../runner/processRunner';
import { ClaudeAgent } from '../../providers/claude/ClaudeAgent';
import { CodexAgent } from '../../providers/codex/CodexAgent';
import { AntigravityAgent } from '../../providers/antigravity/AntigravityAgent';
import { CopilotAgent } from '../../providers/copilot/CopilotAgent';
import { AiderAgent } from '../../providers/aider/AiderAgent';
import { CustomAgent } from '../../providers/custom/CustomAgent';
import { NexusAgent } from '../../providers/nexus/NexusAgent';
import { GrokAgent } from '../../providers/grok/GrokAgent';
import * as fs from 'fs';
import * as path from 'path';

export interface RunOptions {
  root: string;
  mode: string;
  provider: string;
  stage: string;
  plan?: string;
  baseBranch?: string;
  model?: string;
  prompt: string;
  autoApprove?: boolean;
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

function buildRegistry(workspaceRoot: string): AgentRegistry {
  const registry = new AgentRegistry();
  registry.register(new ClaudeAgent());
  registry.register(new CodexAgent());
  registry.register(new AntigravityAgent());
  registry.register(new CopilotAgent());
  registry.register(new AiderAgent());
  registry.register(new CustomAgent(buildCliCustomConfig(workspaceRoot)));
  registry.register(new NexusAgent());
  registry.register(new GrokAgent());
  return registry;
}

export async function runCommandCore(options: RunOptions): Promise<{ exitCode: number }> {
  const workspaceRoot = path.resolve(options.root);
  const mode = options.mode as TaskMode;
  const requestedStage = (options.stage as 'auto' | NexusStage) ?? 'auto';

  const registry = buildRegistry(workspaceRoot);
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
      case 'plan_ready_for_approval':
        if (!options.autoApprove) {
          process.stderr.write(`\nPlan saved to: ${event.planPath ?? '.nexus/plan.md'}\n`);
          process.stderr.write('Run with --auto-approve to execute code automatically, or apply the plan manually.\n');
        }
        break;
    }
  });

  try {
    if (options.provider === 'nexus') {
      // Existing orchestrator flow
      const ctx: PipelineContext = {
        workspaceRoot,
        originalPrompt: options.prompt,
        enhancedPrompt: options.prompt,
        mode,
        model: options.model,
        providerId: 'nexus',
        enableEnhancement: false,
        autoApprove: options.autoApprove ?? false,
      };
      await orchestrator.run(ctx, requestedStage);
    } else {
      // Direct routing with fallback support
      await runWithFallback(options, mode, workspaceRoot, registry, runUseCase);
    }
  } catch (err) {
    process.stderr.write(`Nexus run failed: ${err}\n`);
    return { exitCode: 1 };
  }

  return { exitCode };
}

export async function runCommand(options: RunOptions): Promise<void> {
  try {
    const { exitCode } = await runCommandCore(options);
    process.exit(exitCode);
  } catch (err) {
    process.stderr.write(`Nexus run failed: ${err}\n`);
    process.exit(1);
  }
}

async function runWithFallback(
  options: RunOptions,
  mode: TaskMode,
  workspaceRoot: string,
  registry: AgentRegistry,
  runUseCase: RunAgentUseCase,
): Promise<void> {
  const modelRouter = new ModelRouter();
  const fallbackPolicy = new FallbackPolicy(DEFAULT_FALLBACK_POLICY_CONFIG);

  let plan;
  if (options.provider === 'auto') {
    plan = await modelRouter.resolvePlan('auto', mode, registry);
  } else {
    try {
      plan = ProviderRouteExpressionParser.parse(options.provider);
    } catch (err) {
      process.stderr.write(`Invalid provider expression: ${err}\n`);
      throw new Error(`Invalid provider expression: ${err}`);
    }
  }

  const errors: string[] = [];

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    const agentId = step.providerId as AgentId;
    const model = step.model ?? options.model;

    const task = new AgentTask(
      options.prompt,
      options.prompt,
      agentId,
      mode,
      model,
      workspaceRoot,
    );

    try {
      const result = await runUseCase.execute(task);

      // Check for non-zero exit or empty output — may want to fallback
      if (result.exitCode !== 0 || result.stdout.trim() === '') {
        const reason = ProviderFailureClassifier.classify(result);
        const canFallback = fallbackPolicy.canFallback(reason, i + 1) && i + 1 < plan.steps.length;
        if (canFallback) {
          const nextProvider = plan.steps[i + 1]?.providerId ?? 'next';
          process.stderr.write(`${agentId} failed: ${reason}\nFalling back to ${nextProvider}...\n`);
          errors.push(`${agentId}: ${reason}`);
          continue;
        }
        // No fallback — surface the result (non-zero exit is already handled by event bus)
        return;
      }

      // Success
      return;
    } catch (err) {
      const reason = ProviderFailureClassifier.classify(err);
      const canFallback = fallbackPolicy.canFallback(reason, i + 1) && i + 1 < plan.steps.length;

      if (canFallback) {
        const nextProvider = plan.steps[i + 1]?.providerId ?? 'next';
        process.stderr.write(`${agentId} failed: ${reason}\nFalling back to ${nextProvider}...\n`);
        errors.push(`${agentId}: ${reason}`);
        continue;
      }

      // Cannot fallback — rethrow with accumulated context
      const message = errors.length > 0
        ? `All providers failed: ${errors.join(', ')}; ${agentId}: ${err}`
        : String(err);
      throw new Error(message);
    }
  }

  // All steps exhausted without success
  if (errors.length > 0) {
    throw new Error(`All providers failed: ${errors.join(', ')}`);
  }
}
