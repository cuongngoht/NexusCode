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
import { NexusAgent } from './providers/nexus/NexusAgent';
import { NexusOrchestrator } from './application/nexus/NexusOrchestrator';
import { ChatViewProvider } from './webview/ChatViewProvider';
import { BuildProjectMapUseCase } from './application/usecases/BuildProjectMapUseCase';
import { SummarizeProjectMapUseCase } from './application/usecases/SummarizeProjectMapUseCase';
import { NexusFileTreeScanner } from './context/project-map/NexusFileTreeScanner';
import { NexusMarkerDetector } from './context/project-map/NexusMarkerDetector';
import { NexusProjectUnitDetector } from './context/project-map/NexusProjectUnitDetector';
import { NexusProjectMapBuilder } from './context/project-map/NexusProjectMapBuilder';
import { NexusProjectMapWriter } from './context/project-map/NexusProjectMapWriter';
import { ProjectMapSummaryPromptBuilder } from './context/project-map/summary/ProjectMapSummaryPromptBuilder';
import { ProjectMapAiRunner } from './infrastructure/ai/ProjectMapAiRunner';
import { AiJsonExtractor } from './context/project-map/summary/AiJsonExtractor';
import { ProjectMapSummaryValidator } from './context/project-map/summary/ProjectMapSummaryValidator';
import { ProjectMapMarkdownRenderer } from './context/project-map/summary/ProjectMapMarkdownRenderer';
import { ProjectMapSummaryWriter } from './context/project-map/summary/ProjectMapSummaryWriter';
import type { AgentId } from './core/agent/AgentTask';
import { ConfigService } from './config/ConfigService';
import { ProviderDetector } from './core/providerDetector';
import { SettingsPanel } from './settings/SettingsPanel';
import { AboutPanel } from './settings/AboutPanel';

export function activate(context: vscode.ExtensionContext): void {
  const registry = new AgentRegistry();
  registry.register(new ClaudeAgent());
  registry.register(new CodexAgent());
  registry.register(new GeminiAgent());
  registry.register(new CopilotAgent());
  registry.register(new AiderAgent());
  registry.register(new CustomAgent({
    getCommand: () => vscode.workspace.getConfiguration('nexus').get<string>('customProvider.command') ?? '',
    getArgs: () => vscode.workspace.getConfiguration('nexus').get<string[]>('customProvider.args') ?? ['{{prompt}}'],
  }));
  registry.register(new NexusAgent());

  const eventBus = new EventBus();
  const runner = new ProcessRunner();
  const router = new AgentRouter(registry);
  const runAgent = new RunAgentUseCase(router, runner, eventBus);
  const orchestrator = new NexusOrchestrator(registry, runAgent, eventBus);

  const buildProjectMap = new BuildProjectMapUseCase(
    new NexusFileTreeScanner(),
    new NexusMarkerDetector(),
    new NexusProjectUnitDetector(),
    new NexusProjectMapBuilder(),
    new NexusProjectMapWriter(),
  );

  const summarizeProjectMap = new SummarizeProjectMapUseCase(
    new ProjectMapSummaryPromptBuilder(),
    new ProjectMapAiRunner(registry, runner),
    new AiJsonExtractor(),
    new ProjectMapSummaryValidator(),
    new ProjectMapMarkdownRenderer(),
    new ProjectMapSummaryWriter(),
  );

  const configService = new ConfigService();
  const detector = new ProviderDetector();

  const provider = new ChatViewProvider(
    context.extensionUri,
    runAgent,
    orchestrator,
    eventBus,
    buildProjectMap,
    configService,
    detector,
    context.globalState,
    context.workspaceState,
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

  context.subscriptions.push(
    vscode.commands.registerCommand('nexus.openSettings', () => {
      void SettingsPanel.createOrShow(
        context.extensionUri,
        configService,
        detector,
        () => { void provider.refreshProviders(); },
      );
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('nexus.openAbout', () => {
      AboutPanel.createOrShow(context.extensionUri);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('nexus.summarizeProjectMap', async () => {
      const selected = await vscode.window.showQuickPick(
        ['gemini', 'claude', 'codex', 'custom'],
        { placeHolder: 'Select AI provider for project map summary' },
      );
      if (!selected) { return; }
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return;
      }
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Generating AI Project Summary…', cancellable: false },
        async () => {
          try {
            const result = await summarizeProjectMap.execute({
              workspaceRoot,
              provider: selected as AgentId,
            });
            vscode.window.showInformationMessage(
              `Project summary written: ${result.filesWritten.join(', ')}`,
            );
          } catch (err) {
            vscode.window.showErrorMessage(`Summarize failed: ${err}`);
          }
        },
      );
    }),
  );
}

export function deactivate(): void { }
