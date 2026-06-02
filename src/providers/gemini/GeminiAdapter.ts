import { BaseCliProvider } from '../base/CliProvider';
import { CliCommand, ProviderCapabilities } from '../../core/types';

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

  buildCommand(enhancedPrompt: string): CliCommand {
    return { command: 'gemini', args: [enhancedPrompt] };
  }
}
