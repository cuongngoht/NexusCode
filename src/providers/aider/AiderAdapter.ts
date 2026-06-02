import { BaseCliProvider } from '../base/CliProvider';
import { CliCommand, ProviderCapabilities } from '../../core/types';

export class AiderAdapter extends BaseCliProvider {
  readonly id = 'aider' as const;
  readonly displayName = 'Aider';
  readonly capabilities: ProviderCapabilities = {
    supportsWebSearch: false,
    supportsFileEdit: true,
    supportsShellExec: true,
  };
  protected readonly versionCommand = 'aider';
  protected readonly versionArgs = ['--version'];

  buildCommand(enhancedPrompt: string): CliCommand {
    return { command: 'aider', args: ['--message', enhancedPrompt] };
  }
}
