import { BaseCliProvider } from '../base/CliProvider';
import { CliCommand, ProviderCapabilities } from '../../core/types';

export class ClaudeAdapter extends BaseCliProvider {
  readonly id = 'claude' as const;
  readonly displayName = 'Claude';
  readonly capabilities: ProviderCapabilities = {
    supportsWebSearch: false,
    supportsFileEdit: true,
    supportsShellExec: true,
  };
  protected readonly versionCommand = 'claude';
  protected readonly versionArgs = ['--version'];

  buildCommand(enhancedPrompt: string): CliCommand {
    return { command: 'claude', args: [enhancedPrompt] };
  }
}
