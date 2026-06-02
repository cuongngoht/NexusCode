import { CliProvider, ProviderId } from './types';

export class ProviderRegistry {
  private readonly providers = new Map<ProviderId, CliProvider>();

  register(provider: CliProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: ProviderId): CliProvider | undefined {
    return this.providers.get(id);
  }

  getAll(): CliProvider[] {
    return Array.from(this.providers.values());
  }

  async getAvailable(): Promise<CliProvider[]> {
    const checks = await Promise.all(
      this.getAll().map(async p => ({
        provider: p,
        available: await p.isAvailable().catch(() => false),
      })),
    );
    return checks.filter(c => c.available).map(c => c.provider);
  }
}
