import { spawnSync } from 'child_process';
import { CliProvider, CliCommand, CliRunOptions, ProviderId, ProviderCapabilities } from '../../core/types';

export abstract class BaseCliProvider implements CliProvider {
  abstract readonly id: ProviderId;
  abstract readonly displayName: string;
  abstract readonly capabilities: ProviderCapabilities;

  protected abstract readonly versionCommand: string;
  protected abstract readonly versionArgs: string[];

  async isAvailable(): Promise<boolean> {
    try {
      const result = spawnSync(this.versionCommand, this.versionArgs, {
        timeout: 5000,
        encoding: 'utf8',
        shell: false,
      });
      return result.status === 0 || result.status === 1;
    } catch {
      return false;
    }
  }

  abstract buildCommand(enhancedPrompt: string, options?: CliRunOptions): CliCommand;
}
