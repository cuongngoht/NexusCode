import * as vscode from 'vscode';
import type { ExtensionMessage } from '../webviewProtocol';
import {
  ensureWorkspaceAgents,
  listAgentPrompts,
  type AgentPrompt,
} from '../../context/agentPromptLibrary';
import { requireWorkspaceRoot } from './workspaceUtils';

export class AgentPromptHandler {
  constructor(
    private readonly extensionRoot: string,
    private readonly post: (msg: ExtensionMessage) => void,
  ) {}

  async sendAgentPrompts(): Promise<void> {
    const workspaceRoot = requireWorkspaceRoot(this.post);
    if (!workspaceRoot) return;
    try {
      const cfg = vscode.workspace.getConfiguration('nexus');
      if (!cfg.get<boolean>('agents.enabled', true)) {
        this.post({ type: 'agentPrompts', agents: [] });
        return;
      }
      if (cfg.get<boolean>('agents.autoCopyDefaults', true)) {
        ensureWorkspaceAgents(workspaceRoot, this.extensionRoot);
      }
      const agents = listAgentPrompts(workspaceRoot);
      this.post({ type: 'agentPrompts', agents });
    } catch (err) {
      this.post({ type: 'agentPromptError', message: String(err) });
    }
  }

  async reload(): Promise<void> {
    const workspaceRoot = requireWorkspaceRoot(this.post);
    if (!workspaceRoot) return;
    try {
      const agents = listAgentPrompts(workspaceRoot);
      this.post({ type: 'agentsReloaded', count: agents.length, agents });
    } catch (err) {
      this.post({ type: 'agentPromptError', message: String(err) });
    }
  }

  listKnownIds(): string[] {
    const workspaceRoot = requireWorkspaceRoot(this.post);
    if (!workspaceRoot) return [];
    try {
      return listAgentPrompts(workspaceRoot).map((a: AgentPrompt) => a.id);
    } catch {
      return [];
    }
  }
}
