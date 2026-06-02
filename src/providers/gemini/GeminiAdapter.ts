import { BaseCliProvider } from '../base/CliProvider';
import { CliCommand, CliRunOptions, ProviderCapabilities } from '../../core/types';

export class GeminiAdapter extends BaseCliProvider {
  readonly id = 'gemini' as const;
  readonly displayName = 'Gemini';
  readonly capabilities: ProviderCapabilities = {
    supportsWebSearch: true,
    supportsFileEdit: true,
    supportsShellExec: false,
  };
  protected readonly versionCommand = 'gemini';
  protected readonly versionArgs = ['--version'];

  buildCommand(enhancedPrompt: string, options?: CliRunOptions): CliCommand {
    const args = options?.model
      ? ['--model', options.model, '--prompt', enhancedPrompt]
      : ['--prompt', enhancedPrompt];
    return { command: 'gemini', args };
  }
}
