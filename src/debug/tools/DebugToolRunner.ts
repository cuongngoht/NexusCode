import { spawnSync } from 'child_process';

export interface ToolRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
}

/**
 * Runs a safe diagnostic command synchronously with a timeout.
 * Uses shell: false and splits command into executable + args array.
 */
export function runDiagnosticCommand(
  command: string,
  cwd: string,
  timeoutMs = 30_000,
): ToolRunResult {
  const parts = command.trim().split(/\s+/);
  const executable = parts[0];
  const args = parts.slice(1);

  const startedAt = Date.now();
  const result = spawnSync(executable, args, {
    cwd,
    shell: false,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 512 * 1024, // 512 KB
  });

  return {
    exitCode: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    timedOut: result.error?.message?.includes('ETIMEDOUT') ?? false,
    durationMs: Date.now() - startedAt,
  };
}
