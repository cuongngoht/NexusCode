import { spawn, ChildProcess } from 'child_process';
import { AgentCommand, AgentResult } from '../core/agent';
import type { IProcessRunner, RunOptions } from '../core/runner/IProcessRunner';
import { CommandGuard } from './commandGuard';

// Heuristic: stderr lines that look like internal diagnostic logs, not user-facing errors
function isInternalLog(line: string): boolean {
  return (
    /^\[[\w.]+\] /.test(line) ||          // [ClassName] log format
    /^\s+at (async )?[\w<]/.test(line) || // stack trace: "    at foo.bar"
    /^\s+at file:\/\//.test(line) ||      // stack trace: "    at file:///..."
    /^Error: exception \w/.test(line) ||  // JS Error wrapper around another error
    /YOLO mode is enabled/i.test(line) || // Antigravity CLI startup banner (also on stdout)
    /All tool calls will be automatically approved/i.test(line)
  );
}

function filterNoise(chunk: string): string {
  return chunk
    .split('\n')
    .filter(l => !isInternalLog(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

export class ProcessRunner implements IProcessRunner {
  private activeProcess: ChildProcess | null = null;

  async run(command: AgentCommand, options: RunOptions = {}): Promise<AgentResult> {
    if (this.activeProcess) {
      throw new Error('A task is already running. Stop it before starting a new one.');
    }

    CommandGuard.validate(command.executable);

    const startedAt = Date.now();
    let stdout = '';
    let stderr = '';

    return new Promise((resolve, reject) => {
      const child = spawn(command.executable, [...command.args], {
        cwd: options.cwd,
        shell: false,
        env: {
          ...process.env,
          ...(command.env ?? {}),
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
        },
      });

      this.activeProcess = child;

      if (command.stdin !== undefined) {
        child.stdin.write(command.stdin);
        child.stdin.end();
      }

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      child.stdout.on('data', (chunk: string) => {
        stdout += chunk;
        options.onStdout?.(chunk);
      });

      child.stderr.on('data', (chunk: string) => {
        stderr += chunk;
        const filtered = filterNoise(chunk);
        if (filtered.trim()) options.onStderr?.(filtered);
      });

      child.on('error', (err: Error) => {
        this.activeProcess = null;
        reject(err);
      });

      child.on('close', (code: number | null) => {
        this.activeProcess = null;
        resolve(new AgentResult(code ?? -1, stdout, stderr, Date.now() - startedAt));
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.activeProcess) return;
    const proc = this.activeProcess;
    this.activeProcess = null;
    proc.kill('SIGTERM');
    await new Promise<void>(resolve => setTimeout(resolve, 3000));
    if (!proc.killed) proc.kill('SIGKILL');
  }

  isRunning(): boolean {
    return this.activeProcess !== null;
  }
}
