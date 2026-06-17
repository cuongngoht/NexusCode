import * as vscode from 'vscode';
import type { ExtensionMessage } from '../webviewProtocol';
import {
  ensureWorkspaceCommands,
  listCommandDefs,
} from '../../context/commandPromptLibrary';
import { requireWorkspaceRoot } from './workspaceUtils';

export class CommandPromptHandler {
  constructor(
    private readonly extensionRoot: string,
    private readonly post: (msg: ExtensionMessage) => void,
  ) {}

  async sendCommandDefs(): Promise<void> {
    const workspaceRoot = requireWorkspaceRoot(this.post);
    if (!workspaceRoot) return;
    try {
      const cfg = vscode.workspace.getConfiguration('nexus');
      if (cfg.get<boolean>('commands.autoCopyDefaults', true)) {
        ensureWorkspaceCommands(workspaceRoot, this.extensionRoot);
      }
      const commands = listCommandDefs(workspaceRoot);
      this.post({ type: 'commandDefs', commands });
    } catch (err) {
      this.post({ type: 'commandDefsError', message: String(err) });
    }
  }

  async reload(): Promise<void> {
    const workspaceRoot = requireWorkspaceRoot(this.post);
    if (!workspaceRoot) return;
    try {
      const commands = listCommandDefs(workspaceRoot);
      this.post({ type: 'commandDefsReloaded', count: commands.length, commands });
    } catch (err) {
      this.post({ type: 'commandDefsError', message: String(err) });
    }
  }
}
