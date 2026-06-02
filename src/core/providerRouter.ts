import { CliProvider, ProviderCapabilities, ProviderId, TaskMode } from './types';
import { ProviderRegistry } from './providerRegistry';

function matchesCapabilities(
  provider: CliProvider,
  required: Partial<ProviderCapabilities>,
): boolean {
  return Object.entries(required).every(
    ([key, value]) => provider.capabilities[key as keyof ProviderCapabilities] === value,
  );
}

function requiredForMode(mode: TaskMode): Partial<ProviderCapabilities> | undefined {
  switch (mode) {
    case 'research':
      return { supportsWebSearch: true };
    case 'edit':
    case 'debug':
    case 'test':
      return { supportsFileEdit: true, supportsShellExec: true };
    case 'ask':
    case 'scan-project':
    case 'plan':
    case 'review':
      return undefined;
  }
}

export class ProviderRouter {
  constructor(private readonly registry: ProviderRegistry) {}

  async resolve(requestedId: ProviderId, mode: TaskMode): Promise<CliProvider> {
    if (requestedId !== 'auto') {
      const provider = this.registry.get(requestedId);
      if (!provider) {
        throw new Error(`Provider "${requestedId}" is not registered.`);
      }
      const available = await provider.isAvailable().catch(() => false);
      if (!available) {
        throw new Error(
          `Provider "${provider.displayName}" is not installed or not available on PATH.`,
        );
      }
      return provider;
    }

    const available = await this.registry.getAvailable();
    if (available.length === 0) {
      throw new Error(
        'No CLI providers are installed. Install claude, codex, gemini, copilot, or aider.',
      );
    }

    const required = requiredForMode(mode);
    if (required) {
      const matching = available.find(p => matchesCapabilities(p, required));
      if (matching) {
        return matching;
      }
    }

    return available[0];
  }
}
