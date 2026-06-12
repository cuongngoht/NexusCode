import * as vscode from 'vscode';
import { EventBus } from './core/eventBus';
import { AgentRegistry } from './application/AgentRegistry';
import { AgentRouter } from './application/AgentRouter';
import { RunAgentUseCase } from './application/usecases/RunAgentUseCase';
import { ProcessRunner } from './runner/processRunner';
import { ClaudeAgent } from './providers/claude/ClaudeAgent';
import { CodexAgent } from './providers/codex/CodexAgent';
import { AntigravityAgent } from './providers/antigravity/AntigravityAgent';
import { CopilotAgent } from './providers/copilot/CopilotAgent';
import { AiderAgent } from './providers/aider/AiderAgent';
import { CustomAgent } from './providers/custom/CustomAgent';
import { NexusAgent } from './providers/nexus/NexusAgent';
import { GrokAgent } from './providers/grok/GrokAgent';
import { NexusOrchestrator } from './application/nexus/NexusOrchestrator';
import { ChatViewProvider } from './webview/ChatViewProvider';
import { LauncherViewProvider } from './webview/LauncherViewProvider';
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
import { McpPresetRegistry } from './mcp/McpPresetRegistry';
import { McpPresetSelectionPolicy } from './mcp/McpPresetSelectionPolicy';
import { McpToolRouter } from './mcp/McpToolRouter';
import { McpIntentParser } from './mcp/McpIntentParser';
import { McpExecutionPolicy } from './mcp/McpExecutionPolicy';
import { McpResultCompressor } from './mcp/McpResultCompressor';
import { StdioMcpClientAdapter } from './mcp/adapters/StdioMcpClientAdapter';
import { StreamableHttpMcpClientAdapter } from './mcp/adapters/StreamableHttpMcpClientAdapter';
import { McpBroker } from './mcp/McpBroker';
import { McpToolUseCase } from './mcp/McpToolUseCase';
import { SubagentRegistry } from './application/subagents/SubagentRegistry';
import { SubagentRouter } from './application/subagents/SubagentRouter';
import { SubagentPlanner } from './application/subagents/SubagentPlanner';
import { SubagentExecutor } from './application/subagents/SubagentExecutor';
import { SubagentOrchestrator } from './application/subagents/SubagentOrchestrator';
import { DEFAULT_SUBAGENTS } from './application/subagents/DefaultSubagents';
import { ConversationCompactor } from './context/ConversationCompactor';
import {
  createWorkflowAgentFile,
  isWorkspaceAgentsDir,
  normalizeAgentId,
} from './context/workflowAgentCreator';

export function activate(context: vscode.ExtensionContext): void {
  const registry = new AgentRegistry();
  registry.register(new ClaudeAgent());
  registry.register(new CodexAgent());
  registry.register(new AntigravityAgent());
  registry.register(new CopilotAgent());
  registry.register(new AiderAgent());
  registry.register(new CustomAgent({
    getCommand: () => vscode.workspace.getConfiguration('nexus').get<string>('customProvider.command') ?? '',
    getArgs: () => vscode.workspace.getConfiguration('nexus').get<string[]>('customProvider.args') ?? ['{{prompt}}'],
  }));
  registry.register(new GrokAgent());
  registry.register(new NexusAgent());

  const eventBus = new EventBus();
  const runner = new ProcessRunner();
  const router = new AgentRouter(registry);
  const configService = new ConfigService();

  const mcpPresetRegistry = new McpPresetRegistry();
  const mcpPresetSelectionPolicy = new McpPresetSelectionPolicy();
  const mcpToolRouter = new McpToolRouter();
  const mcpIntentParser = new McpIntentParser();
  const mcpExecutionPolicy = new McpExecutionPolicy();
  const mcpResultCompressor = new McpResultCompressor();
  const stdioMcpAdapter = new StdioMcpClientAdapter();
  const httpMcpAdapter = new StreamableHttpMcpClientAdapter();
  const mcpBroker = new McpBroker(stdioMcpAdapter, httpMcpAdapter);
  const mcpToolUseCase = new McpToolUseCase(
    mcpPresetRegistry,
    mcpPresetSelectionPolicy,
    mcpToolRouter,
    mcpIntentParser,
    mcpExecutionPolicy,
    mcpBroker,
    mcpResultCompressor,
  );

  const runAgent = new RunAgentUseCase(router, runner, eventBus, mcpToolUseCase, configService);
  const orchestrator = new NexusOrchestrator(registry, runAgent, eventBus);

  const subagentRegistry = new SubagentRegistry();
  DEFAULT_SUBAGENTS.forEach(d => subagentRegistry.register(d));
  const subagentRouter = new SubagentRouter(registry);
  const subagentPlanner = new SubagentPlanner(subagentRegistry);
  const subagentExecutor = new SubagentExecutor(runner, context.extensionPath);
  const subagentOrchestrator = new SubagentOrchestrator(subagentPlanner, subagentRouter, subagentExecutor);

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

  const detector = new ProviderDetector();

  const compactor = new ConversationCompactor(registry, runner);

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
    subagentOrchestrator,
    compactor,
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ChatViewProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
  );

  LauncherViewProvider.register(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('nexus.openChat', () => {
      void vscode.commands.executeCommand('nexus.chatView.focus');
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
        ['antigravity', 'claude', 'codex', 'custom'],
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

  context.subscriptions.push(
    vscode.commands.registerCommand('nexus.createWorkflowAgent', async (uri?: vscode.Uri) => {
      const workspaceFolder = uri
        ? vscode.workspace.getWorkspaceFolder(uri)
        : vscode.workspace.workspaceFolders?.[0];

      if (!workspaceFolder) {
        vscode.window.showErrorMessage('Selected folder is not inside the current workspace.');
        return;
      }

      const workspaceRoot = workspaceFolder.uri.fsPath;

      if (!uri?.fsPath) {
        vscode.window.showErrorMessage('Right-click the .nexus/agents folder to create a workflow agent.');
        return;
      }

      if (!isWorkspaceAgentsDir(workspaceRoot, uri.fsPath)) {
        vscode.window.showErrorMessage('Nexus workflow agents can only be created inside .nexus/agents.');
        return;
      }

      const rawName = await vscode.window.showInputBox({
        title: 'Create Nexus Workflow Agent',
        prompt: 'Enter a workflow agent name. Example: release-manager, qa-checklist, portal-planner',
        placeHolder: 'my-workflow-agent',
        validateInput(value) {
          const normalized = normalizeAgentId(value);
          if (!normalized) {
            return 'Enter a valid agent name.';
          }
          return undefined;
        },
      });

      if (!rawName) {
        return;
      }

      try {
        const result = createWorkflowAgentFile({
          workspaceRoot,
          selectedFolderPath: uri.fsPath,
          rawName,
          extensionRoot: context.extensionUri.fsPath,
        });

        const document = await vscode.workspace.openTextDocument(vscode.Uri.file(result.filePath));
        await vscode.window.showTextDocument(document);

        await provider.reloadAgentPrompts();

        if (result.alreadyExists) {
          vscode.window.showWarningMessage(`Workflow agent already exists: @${result.agentId}`);
        } else {
          vscode.window.showInformationMessage(`Created Nexus workflow agent: @${result.agentId}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Create workflow agent failed: ${message}`);
      }
    }),
  );
}

export function deactivate(): void { }
