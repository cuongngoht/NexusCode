import * as vscode from 'vscode';
import { ProviderRegistry } from './core/providerRegistry';
import { TaskManager } from './core/taskManager';
import { ProcessRunner } from './runner/processRunner';
import { ChatPanel } from './webview/ChatPanel';
import { CodexAdapter } from './providers/codex/CodexAdapter';
import { ClaudeAdapter } from './providers/claude/ClaudeAdapter';
import { GeminiAdapter } from './providers/gemini/GeminiAdapter';
import { CopilotAdapter } from './providers/copilot/CopilotAdapter';
import { AiderAdapter } from './providers/aider/AiderAdapter';
import { CustomAdapter } from './providers/custom/CustomAdapter';

export function activate(context: vscode.ExtensionContext): void {
  const registry = new ProviderRegistry();
  registry.register(new ClaudeAdapter());
  registry.register(new CodexAdapter());
  registry.register(new GeminiAdapter());
  registry.register(new CopilotAdapter());
  registry.register(new AiderAdapter());
  registry.register(new CustomAdapter());

  const taskManager = new TaskManager();
  const processRunner = new ProcessRunner();

  const openChatCommand = vscode.commands.registerCommand('nexus.openChat', () => {
    ChatPanel.createOrShow(
      context.extensionUri,
      registry,
      taskManager,
      processRunner,
    );
  });

  context.subscriptions.push(openChatCommand);
}

export function deactivate(): void {
  // nothing to clean up globally; ChatPanel handles its own disposal
}
