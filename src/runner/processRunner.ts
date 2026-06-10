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

    const label = `[ProcessRunner] ${command.executable}`;
    const truncatedArgs = command.args.map(a => a.length > 200 ? a.slice(0, 200) + '…' : a);
    console.log(`${label} spawn`, { args: truncatedArgs, cwd: options.cwd });

    return new Promise((resolve, reject) => {
      const child = spawn(command.executable, [...command.args], {
        cwd: options.cwd,
        shell: false,
        stdio: [
          command.stdin === undefined ? 'ignore' : 'pipe',
          'pipe',
          'pipe',
        ],
        env: {
          ...process.env,
          ...(command.env ?? {}),
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
        },
      });

      this.activeProcess = child;
      console.log(`${label} pid=${child.pid}`);
      const childStdout = child.stdout;
      const childStderr = child.stderr;
      if (!childStdout || !childStderr) {
        this.activeProcess = null;
        reject(new Error('Failed to open stdout/stderr pipes for child process.'));
        return;
      }

      if (command.stdin !== undefined) {
        const stdinPreview = command.stdin.slice(0, 300);
        console.log(`${label} stdin (${command.stdin.length} chars):`, stdinPreview);
        child.stdin?.write(command.stdin);
        child.stdin?.end();
      }

      childStdout.setEncoding('utf8');
      childStderr.setEncoding('utf8');

      childStdout.on('data', (chunk: string) => {
        stdout += chunk;
        console.log(`${label} stdout chunk (${chunk.length} chars):`, chunk.slice(0, 300));
        options.onStdout?.(chunk);
      });

      childStderr.on('data', (chunk: string) => {
        stderr += chunk;
        console.log(`${label} stderr chunk:`, chunk.slice(0, 300));
        const filtered = filterNoise(chunk);
        if (filtered.trim()) options.onStderr?.(filtered);
      });

      child.on('error', (err: Error) => {
        console.error(`${label} error:`, err.message);
        this.activeProcess = null;
        reject(err);
      });

      child.on('close', (code: number | null) => {
        console.log(`${label} closed, exit code=${code}, elapsed=${Date.now() - startedAt}ms`);
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
