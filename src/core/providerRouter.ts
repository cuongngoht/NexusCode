import { CliProvider, ProviderId, TaskMode } from './types';
import { ProviderRegistry } from './providerRegistry';

const RESEARCH_MODES: TaskMode[] = ['research', 'ask'];

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

    const isResearch = RESEARCH_MODES.includes(mode);
    if (isResearch) {
      const webSearch = available.find(p => p.capabilities.supportsWebSearch);
      if (webSearch) {
        return webSearch;
      }
    } else {
      const editable = available.find(
        p => p.capabilities.supportsFileEdit && p.capabilities.supportsShellExec,
      );
      if (editable) {
        return editable;
      }
    }

    return available[0];
  }
}
