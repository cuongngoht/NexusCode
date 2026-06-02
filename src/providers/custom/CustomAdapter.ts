import * as vscode from 'vscode';
import { CliProvider, CliCommand, CliRunOptions, ProviderId, ProviderCapabilities } from '../../core/types';
import { spawnSync } from 'child_process';
import { CommandGuard } from '../../runner/commandGuard';

export class CustomAdapter implements CliProvider {
  readonly id: ProviderId = 'custom';
  readonly displayName = 'Custom';
  readonly capabilities: ProviderCapabilities = {
    supportsWebSearch: false,
    supportsFileEdit: true,
    supportsShellExec: true,
  };

  private getConfig(): { command: string; args: string[] } {
    const cfg = vscode.workspace.getConfiguration('nexus');
    return {
      command: cfg.get<string>('customProvider.command', ''),
      args: cfg.get<string[]>('customProvider.args', []),
    };
  }

  async isAvailable(): Promise<boolean> {
    const { command } = this.getConfig();
    if (!command) {
      return false;
    }
    try {
      CommandGuard.validate(command);
    } catch {
      return false;
    }
    try {
      const result = spawnSync(command, ['--version'], {
        timeout: 5000,
        encoding: 'utf8',
        shell: false,
      });
      return result.status === 0 || result.status === 1;
    } catch {
      return false;
    }
  }

  buildCommand(enhancedPrompt: string, options?: CliRunOptions): CliCommand {
    const { command, args } = this.getConfig();
    if (!command) {
      throw new Error('nexus.customProvider.command is not set.');
    }
    CommandGuard.validate(command);
    const resolvedArgs = args.length > 0
      ? args.map(a => a
        .replace('{{prompt}}', enhancedPrompt)
        .replace('{{model}}', options?.model ?? ''))
      : [enhancedPrompt];
    const hasPromptPlaceholder = args.some(a => a.includes('{{prompt}}'));
    if (!hasPromptPlaceholder && args.length > 0) {
      return { command, args: [...args, enhancedPrompt] };
    }
    return { command, args: resolvedArgs };
  }
}
