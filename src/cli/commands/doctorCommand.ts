import * as readline from 'readline';
import { exec } from 'child_process';
import { ProviderHealthChecker } from '../../provider-hub/ProviderHealthChecker';
import type { ProviderHealthEntry } from '../../provider-hub/ProviderHealthChecker';
import { getAllProviderSpecs } from '../../provider-hub/ProviderSpecRegistry';
import type { ProviderId } from '../../core/types';

interface DoctorOptions {
  fix?: boolean;
  provider?: string;
  json?: boolean;
  yes?: boolean;
}

/** Classify install risk based on command content. */
function classifyRisk(command: string): 'high' | 'medium' | 'low' {
  const lower = command.toLowerCase();
  if (
    lower.includes('curl') ||
    lower.includes('irm') ||
    lower.includes('iex') ||
    lower.match(/powershell\s+-/)
  ) {
    return 'high';
  }
  if (lower.includes('npm install') || lower.includes('brew install') || lower.includes('apt install')) {
    return 'medium';
  }
  return 'low';
}

function askConfirmation(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(`${message} [y/N] `, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

function runInstallCommand(command: string): Promise<number> {
  return new Promise(resolve => {
    process.stderr.write(`Running: ${command}\n`);
    // Install commands may contain shell pipes/redirects — exec is appropriate
    // for these hardcoded, spec-defined admin operations.
    const proc = exec(command, (err) => {
      resolve(err ? (err.code ?? 1) : 0);
    });
    proc.stdout?.pipe(process.stdout);
    proc.stderr?.pipe(process.stderr);
  });
}

function getPlatformInstallCommand(entry: ProviderHealthEntry): string | undefined {
  return entry.installCommand;
}

function formatEntry(entry: ProviderHealthEntry, verbose: boolean): string {
  const statusIcon = entry.installed
    ? (entry.authStatus === 'authenticated' ? '✓' : (entry.authStatus === 'unauthenticated' ? '!' : '?'))
    : '✗';
  const versionStr = entry.version ? ` v${entry.version}` : '';
  const lines: string[] = [
    `  ${statusIcon} ${entry.displayName}${versionStr}`,
  ];
  if (!entry.installed && verbose) {
    lines.push(`      Not installed`);
    if (entry.installCommand) lines.push(`      Install: ${entry.installCommand}`);
  }
  if (entry.installed && entry.authStatus === 'unauthenticated' && verbose) {
    lines.push(`      Not authenticated`);
    if (entry.loginCommand) lines.push(`      Login: ${entry.loginCommand}`);
  }
  if (entry.modelCount === 0 && verbose) {
    lines.push(`      No models available`);
  }
  if (entry.issues.length === 0 && verbose) {
    lines.push(`      Models: ${entry.modelCount}`);
  }
  return lines.join('\n');
}

function isValidProviderId(id: string): id is ProviderId {
  return getAllProviderSpecs().some(s => s.id === id);
}

export async function doctorCommand(options: DoctorOptions): Promise<void> {
  try {
    let onlyId: ProviderId | undefined;
    if (options.provider) {
      if (!isValidProviderId(options.provider)) {
        process.stderr.write(`Unknown provider: '${options.provider}'\n`);
        process.exit(1);
        return;
      }
      onlyId = options.provider;
    }

    const checker = new ProviderHealthChecker();
    const report = await checker.check(onlyId);

    if (options.json) {
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
      return;
    }

    process.stdout.write(`\nNexus Provider Health Check\n`);
    process.stdout.write(`Generated: ${report.generatedAt}\n\n`);

    const ok = report.entries.filter(e => e.issues.length === 0);
    const issues = report.entries.filter(e => e.issues.length > 0);

    if (ok.length > 0) {
      process.stdout.write('Healthy:\n');
      for (const entry of ok) {
        process.stdout.write(formatEntry(entry, false) + '\n');
      }
    }

    if (issues.length > 0) {
      process.stdout.write('\nIssues:\n');
      for (const entry of issues) {
        process.stdout.write(formatEntry(entry, true) + '\n');
      }
    }

    if (issues.length === 0) {
      process.stdout.write('\nAll providers are healthy.\n');
    }

    // --fix: attempt to install missing CLIs
    if (options.fix) {
      const missing = report.entries.filter(e => e.issues.includes('missing_cli'));
      if (missing.length === 0) {
        process.stdout.write('\nNo missing CLIs to install.\n');
        return;
      }

      process.stdout.write('\nAttempting to install missing CLIs...\n');
      for (const entry of missing) {
        const installCmd = getPlatformInstallCommand(entry);
        if (!installCmd) {
          process.stderr.write(`  No install command available for ${entry.displayName}\n`);
          continue;
        }

        const risk = classifyRisk(installCmd);
        if (risk === 'high' && !options.yes) {
          process.stdout.write(`\n  HIGH RISK install for ${entry.displayName}:\n`);
          process.stdout.write(`  Command: ${installCmd}\n`);
          const confirmed = await askConfirmation(`  Proceed?`);
          if (!confirmed) {
            process.stdout.write(`  Skipped ${entry.displayName}\n`);
            continue;
          }
        } else if (risk !== 'low' && !options.yes) {
          process.stdout.write(`\n  Installing ${entry.displayName}:\n`);
          process.stdout.write(`  Command: ${installCmd}\n`);
          const confirmed = await askConfirmation(`  Proceed?`);
          if (!confirmed) {
            process.stdout.write(`  Skipped ${entry.displayName}\n`);
            continue;
          }
        } else {
          process.stdout.write(`\n  Installing ${entry.displayName}: ${installCmd}\n`);
        }

        const exitCode = await runInstallCommand(installCmd);
        if (exitCode === 0) {
          process.stdout.write(`  Installed ${entry.displayName} successfully.\n`);
        } else {
          process.stderr.write(`  Failed to install ${entry.displayName} (exit ${exitCode}).\n`);
        }
      }
    }
  } catch (err) {
    process.stderr.write(`nexus doctor error: ${err}\n`);
    process.exit(1);
  }
}
