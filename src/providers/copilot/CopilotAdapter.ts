import { BaseCliProvider } from '../base/CliProvider';
import { CliCommand, ProviderCapabilities } from '../../core/types';

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

  buildCommand(enhancedPrompt: string): CliCommand {
    return { command: 'copilot', args: [enhancedPrompt] };
  }
}
