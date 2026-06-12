import { ProviderDetector } from '../../core/providerDetector';
import { getAllProviderSpecs, getProviderSpec } from '../../provider-hub/ProviderSpecRegistry';
import { CustomProviderScaffolder } from '../../provider-hub/custom/CustomProviderScaffolder';
import type { ProviderId } from '../../core/types';

interface ProviderOptions {
  json?: boolean;
}

function isValidProviderId(id: string): id is ProviderId {
  return getAllProviderSpecs().some(s => s.id === id);
}

async function runList(options: ProviderOptions): Promise<void> {
  const detector = new ProviderDetector();
  const results = await detector.detectAll();

  if (options.json) {
    process.stdout.write(JSON.stringify(results, null, 2) + '\n');
    return;
  }

  process.stdout.write('\nInstalled providers:\n\n');
  for (const r of results) {
    const status = r.installed
      ? `✓ installed v${r.version ?? '?'}`
      : '✗ not installed';
    const auth = r.installed
      ? (r.authStatus === 'authenticated' ? ' (authenticated)' :
        r.authStatus === 'unauthenticated' ? ' (not authenticated)' : '')
      : '';
    process.stdout.write(`  ${r.displayName.padEnd(16)} ${status}${auth}\n`);
  }
}

async function runStatus(providerId: string, options: ProviderOptions): Promise<void> {
  if (!isValidProviderId(providerId)) {
    process.stderr.write(`Unknown provider: '${providerId}'\n`);
    process.exit(1);
    return;
  }

  const detector = new ProviderDetector();
  const result = await detector.detectOne(providerId);

  if (!result) {
    process.stderr.write(`Provider '${providerId}' not found in registry.\n`);
    process.exit(1);
    return;
  }

  if (options.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }

  process.stdout.write(`\n${result.displayName} (${result.cliLabel})\n`);
  process.stdout.write(`  Installed:   ${result.installed ? 'yes' : 'no'}\n`);
  if (result.version) process.stdout.write(`  Version:     ${result.version}\n`);
  if (result.executablePath) process.stdout.write(`  Path:        ${result.executablePath}\n`);
  process.stdout.write(`  Auth:        ${result.authStatus}\n`);
  if (result.installCommand) process.stdout.write(`  Install:     ${result.installCommand}\n`);
  if (result.loginCommand) process.stdout.write(`  Login:       ${result.loginCommand}\n`);
  if (result.installDocsUrl) process.stdout.write(`  Docs:        ${result.installDocsUrl}\n`);
}

function runInstall(providerId: string, options: ProviderOptions): void {
  if (!isValidProviderId(providerId)) {
    process.stderr.write(`Unknown provider: '${providerId}'\n`);
    process.exit(1);
    return;
  }

  const spec = getProviderSpec(providerId);
  if (!spec?.installCommands) {
    process.stderr.write(`No install command available for '${providerId}'\n`);
    process.exit(1);
    return;
  }

  const platform = process.platform as 'darwin' | 'linux' | 'win32';
  const cmd = spec.installCommands[platform] ??
    spec.installCommands.linux ??
    spec.installCommands.darwin ??
    spec.installCommands.win32;

  if (!cmd) {
    process.stderr.write(`No install command for current platform (${process.platform})\n`);
    process.exit(1);
    return;
  }

  if (options.json) {
    process.stdout.write(JSON.stringify({ provider: providerId, platform, command: cmd }, null, 2) + '\n');
    return;
  }

  process.stdout.write(`\nInstall command for ${spec.displayName}:\n\n  ${cmd}\n\n`);
  if (spec.installDocsUrl) {
    process.stdout.write(`Documentation: ${spec.installDocsUrl}\n`);
  }
}

async function runNew(name: string, options: ProviderOptions): Promise<void> {
  const scaffolder = new CustomProviderScaffolder();
  try {
    const filePath = await scaffolder.scaffold(name, process.cwd());
    if (options.json) {
      process.stdout.write(JSON.stringify({ name, path: filePath }, null, 2) + '\n');
      return;
    }
    process.stdout.write(`Created provider scaffold at: ${filePath}\n`);
    process.stdout.write(`Edit the file to configure your provider.\n`);
  } catch (err) {
    process.stderr.write(`nexus provider new failed: ${err}\n`);
    process.exit(1);
  }
}

export async function providerCommand(
  action: string = 'list',
  target: string | undefined,
  options: ProviderOptions,
): Promise<void> {
  try {
    switch (action) {
      case 'list':
        await runList(options);
        break;
      case 'status':
        if (!target) {
          process.stderr.write('Usage: nexus provider status <id>\n');
          process.exit(1);
          return;
        }
        await runStatus(target, options);
        break;
      case 'install':
        if (!target) {
          process.stderr.write('Usage: nexus provider install <id>\n');
          process.exit(1);
          return;
        }
        runInstall(target, options);
        break;
      case 'new':
        if (!target) {
          process.stderr.write('Usage: nexus provider new <name>\n');
          process.exit(1);
          return;
        }
        await runNew(target, options);
        break;
      default:
        process.stderr.write(`Unknown provider action: '${action}'. Use: list, status, install, new\n`);
        process.exit(1);
    }
  } catch (err) {
    process.stderr.write(`nexus provider error: ${err}\n`);
    process.exit(1);
  }
}
