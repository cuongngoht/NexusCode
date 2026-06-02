import { BaseCliProvider } from '../base/CliProvider';
import { CliCommand, CliRunOptions, ProviderCapabilities } from '../../core/types';

export class CopilotAdapter extends BaseCliProvider {
  readonly id = 'copilot' as const;
  readonly displayName = 'Copilot';
  readonly capabilities: ProviderCapabilities = {
    supportsWebSearch: false,
    supportsFileEdit: true,
    supportsShellExec: false,
  };
  protected readonly versionCommand = 'copilot';
  protected readonly versionArgs = ['--version'];

  buildCommand(enhancedPrompt: string, options?: CliRunOptions): CliCommand {
    const args = options?.model
      ? ['--model', options.model, '--prompt', enhancedPrompt]
      : ['--prompt', enhancedPrompt];
    return { command: 'copilot', args };
  }
}
