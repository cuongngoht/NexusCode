import { BaseCliProvider } from '../base/CliProvider';
import { CliCommand, ProviderCapabilities } from '../../core/types';

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

  buildCommand(enhancedPrompt: string): CliCommand {
    return { command: 'codex', args: [enhancedPrompt] };
  }
}
