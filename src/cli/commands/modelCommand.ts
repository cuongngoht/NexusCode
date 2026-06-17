import { ProviderDetector } from '../../provider-hub/ProviderDetector';
import { ProviderModelLister } from '../../provider-hub/ProviderModelLister';
import { getAllProviderSpecs } from '../../provider-hub/ProviderSpecRegistry';
import type { ProviderId } from '../../core/types';

interface ModelOptions {
  json?: boolean;
}

function isValidProviderId(id: string): id is ProviderId {
  return getAllProviderSpecs().some(s => s.id === id);
}

async function runList(providerId: string | undefined, options: ModelOptions): Promise<void> {
  const lister = new ProviderModelLister();
  const detector = new ProviderDetector();

  if (providerId) {
    if (!isValidProviderId(providerId)) {
      process.stderr.write(`Unknown provider: '${providerId}'\n`);
      process.exit(1);
      return;
    }
    const models = await lister.list(providerId);
    if (options.json) {
      process.stdout.write(JSON.stringify({ provider: providerId, models }, null, 2) + '\n');
      return;
    }
    const detection = await detector.detectOne(providerId);
    const displayName = detection?.displayName ?? providerId;
    process.stdout.write(`${displayName}\n`);
    for (const m of models) {
      process.stdout.write(`  - ${m.id.padEnd(30)} ${m.source}\n`);
    }
    return;
  }

  // List all providers
  const allModels = await lister.listAll();
  if (options.json) {
    const out: Record<string, unknown> = {};
    for (const [id, models] of allModels) {
      out[id] = models;
    }
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    return;
  }

  const specs = getAllProviderSpecs();
  for (const spec of specs) {
    const models = allModels.get(spec.id) ?? [];
    process.stdout.write(`\n${spec.displayName}\n`);
    for (const m of models) {
      process.stdout.write(`  - ${m.id.padEnd(30)} ${m.source}\n`);
    }
  }
}

async function runRefresh(providerId: string | undefined, options: ModelOptions): Promise<void> {
  const lister = new ProviderModelLister();

  if (providerId) {
    if (!isValidProviderId(providerId)) {
      process.stderr.write(`Unknown provider: '${providerId}'\n`);
      process.exit(1);
      return;
    }
    const models = await lister.list(providerId, { force: true });
    if (options.json) {
      process.stdout.write(JSON.stringify({ provider: providerId, models }, null, 2) + '\n');
      return;
    }
    process.stdout.write(`Refreshed ${providerId}: ${models.length} model(s)\n`);
    for (const m of models) {
      process.stdout.write(`  - ${m.id}\n`);
    }
    return;
  }

  const allModels = await lister.listAll({ force: true });
  if (options.json) {
    const out: Record<string, unknown> = {};
    for (const [id, models] of allModels) {
      out[id] = models;
    }
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
    return;
  }
  let total = 0;
  for (const [, models] of allModels) total += models.length;
  process.stdout.write(`Refreshed all providers: ${total} total model(s)\n`);
}

export async function modelCommand(
  action: string = 'list',
  provider: string | undefined,
  options: ModelOptions,
): Promise<void> {
  try {
    switch (action) {
      case 'list':
        await runList(provider, options);
        break;
      case 'refresh':
        await runRefresh(provider, options);
        break;
      default:
        process.stderr.write(`Unknown model action: '${action}'. Use: list, refresh\n`);
        process.exit(1);
    }
  } catch (err) {
    process.stderr.write(`nexus model error: ${err}\n`);
    process.exit(1);
  }
}
