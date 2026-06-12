import type { ProviderId, ProviderModel } from '../core/types';

interface CacheEntry {
  createdAt: number;
  models: ProviderModel[];
}

export class ModelCache {
  private readonly cache = new Map<ProviderId, CacheEntry>();

  constructor(private readonly ttlMs = 5 * 60 * 1000) {}

  get(providerId: ProviderId): ProviderModel[] | undefined {
    const hit = this.cache.get(providerId);
    if (!hit) return undefined;
    if (Date.now() - hit.createdAt > this.ttlMs) {
      this.cache.delete(providerId);
      return undefined;
    }
    return hit.models;
  }

  set(providerId: ProviderId, models: ProviderModel[]): void {
    this.cache.set(providerId, { createdAt: Date.now(), models });
  }

  invalidate(providerId?: ProviderId): void {
    if (providerId) {
      this.cache.delete(providerId);
    } else {
      this.cache.clear();
    }
  }
}
