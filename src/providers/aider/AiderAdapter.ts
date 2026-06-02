import { BaseCliProvider } from '../base/CliProvider';
import { CliCommand, CliRunOptions, ProviderCapabilities } from '../../core/types';

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

  buildCommand(enhancedPrompt: string, options?: CliRunOptions): CliCommand {
    const args = options?.model
      ? ['--model', options.model, '--message', enhancedPrompt]
      : ['--message', enhancedPrompt];
    return { command: 'aider', args };
  }
}
