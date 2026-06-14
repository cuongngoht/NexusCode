import { ProviderModelLister } from '../../provider-hub/ProviderModelLister';
import { getAllProviderSpecs } from '../../provider-hub/ProviderSpecRegistry';
import type { ProviderId } from '../../core/types';
import { normalizeProviderAlias } from '../../application/prompt/ProviderAliasResolver';

export async function printConsoleModels(providerId?: string, force?: boolean): Promise<void> {
  const lister = new ProviderModelLister();
  const options = force ? { force: true } : {};

  if (providerId) {
    const normalizedId = normalizeProviderAlias(providerId) as ProviderId;
    const models = await lister.list(normalizedId, options);
    if (models.length === 0) {
      process.stdout.write(`No models found for provider: ${normalizedId}\n`);
      return;
    }
    process.stdout.write(`Models for ${normalizedId}:\n`);
    for (const model of models) {
      const sourceTag = model.source === 'seeded' ? ' (seeded)' : '';
      process.stdout.write(`  ${model.id}${sourceTag}\n`);
    }
    return;
  }

  // List all providers
  const specs = getAllProviderSpecs();
  const allModels = await lister.listAll(options);

  for (const spec of specs) {
    const models = allModels.get(spec.id) ?? [];
    process.stdout.write(`\n${spec.displayName} (${spec.id}):\n`);
    if (models.length === 0) {
      process.stdout.write('  (no models)\n');
    } else {
      for (const model of models) {
        const sourceTag = model.source === 'seeded' ? ' (seeded)' : '';
        process.stdout.write(`  ${model.id}${sourceTag}\n`);
      }
    }
  }
  process.stdout.write('\n');
}
