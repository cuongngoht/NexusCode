import * as vscode from 'vscode';
import { EventBus } from './core/eventBus';
import { AgentRegistry } from './application/AgentRegistry';
import { AgentRouter } from './application/AgentRouter';
import { RunAgentUseCase } from './application/usecases/RunAgentUseCase';
import { ProcessRunner } from './runner/processRunner';
import { ClaudeAgent } from './providers/claude/ClaudeAgent';
import { CodexAgent } from './providers/codex/CodexAgent';
import { GeminiAgent } from './providers/gemini/GeminiAgent';
import { CopilotAgent } from './providers/copilot/CopilotAgent';
import { AiderAgent } from './providers/aider/AiderAgent';
import { CustomAgent } from './providers/custom/CustomAgent';
import { ChatViewProvider } from './webview/ChatViewProvider';
import { BuildProjectMapUseCase } from './application/usecases/BuildProjectMapUseCase';
import { NexusFileTreeScanner } from './context/project-map/NexusFileTreeScanner';
import { NexusMarkerDetector } from './context/project-map/NexusMarkerDetector';
import { NexusProjectUnitDetector } from './context/project-map/NexusProjectUnitDetector';
import { NexusProjectMapBuilder } from './context/project-map/NexusProjectMapBuilder';
import { NexusProjectMapWriter } from './context/project-map/NexusProjectMapWriter';

export function activate(context: vscode.ExtensionContext): void {
  const registry = new AgentRegistry();
  registry.register(new ClaudeAgent());
  registry.register(new CodexAgent());
  registry.register(new GeminiAgent());
  registry.register(new CopilotAgent());
  registry.register(new AiderAgent());
  registry.register(new CustomAgent());

  const eventBus = new EventBus();
  const runner = new ProcessRunner();
  const router = new AgentRouter(registry);
  const runAgent = new RunAgentUseCase(router, runner, eventBus);

  const buildProjectMap = new BuildProjectMapUseCase(
    new NexusFileTreeScanner(),
    new NexusMarkerDetector(),
    new NexusProjectUnitDetector(),
    new NexusProjectMapBuilder(),
    new NexusProjectMapWriter(),
  );

  const provider = new ChatViewProvider(
    context.extensionUri,
    runAgent,
    eventBus,
    buildProjectMap,
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ChatViewProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('nexus.openChat', () => {
      vscode.commands.executeCommand('workbench.view.extension.nexus');
    }),
  );
}

export function deactivate(): void { }
