import { BaseCliProvider } from '../base/CliProvider';
import { CliCommand, CliRunOptions, ProviderCapabilities } from '../../core/types';

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

  buildCommand(enhancedPrompt: string, options?: CliRunOptions): CliCommand {
    const args = options?.model ? ['--model', options.model, enhancedPrompt] : [enhancedPrompt];
    return { command: 'claude', args };
  }
}
