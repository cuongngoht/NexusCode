import { BaseCliProvider } from '../base/CliProvider';
import { CliCommand, CliRunOptions, ProviderCapabilities } from '../../core/types';

export class CodexAdapter extends BaseCliProvider {
  readonly id = 'codex' as const;
  readonly displayName = 'Codex';
  readonly capabilities: ProviderCapabilities = {
    supportsWebSearch: false,
    supportsFileEdit: true,
    supportsShellExec: true,
  };
  protected readonly versionCommand = 'codex';
  protected readonly versionArgs = ['--version'];

  buildCommand(enhancedPrompt: string, options?: CliRunOptions): CliCommand {
    const args = options?.model ? ['--model', options.model, enhancedPrompt] : [enhancedPrompt];
    return { command: 'codex', args };
  }
}
