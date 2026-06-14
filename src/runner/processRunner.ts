import { spawn, ChildProcess } from 'child_process';
import { AgentCommand, AgentResult } from '../core/agent';
import type { IProcessRunner, RunOptions } from '../core/runner/IProcessRunner';
import { CommandGuard } from './commandGuard';

// Heuristic: stderr lines that look like internal diagnostic logs, not user-facing errors
const DEBUG = process.env.NEXUS_DEBUG === '1';

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
        // detached on Unix so we can kill the entire process group (negative PID)
        detached: process.platform !== 'win32',
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
        if (DEBUG) {
          const stdinPreview = command.stdin.slice(0, 300);
          console.log(`${label} stdin (${command.stdin.length} chars):`, stdinPreview);
        }
        child.stdin?.write(command.stdin);
        child.stdin?.end();
      }

      childStdout.setEncoding('utf8');
      childStderr.setEncoding('utf8');

      // Idle-timeout: kill the process if it produces no output for idleTimeoutMs.
      let idleTimer: ReturnType<typeof setTimeout> | undefined;
      const resetIdle = (): void => {
        if (!options.idleTimeoutMs) return;
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          console.warn(`${label} idle timeout (${options.idleTimeoutMs}ms) — killing process`);
          try {
            if (process.platform === 'win32') {
              spawn('taskkill', ['/F', '/T', '/PID', String(child.pid!)], { shell: false }).unref();
            } else {
              process.kill(-child.pid!, 'SIGTERM');
            }
          } catch { /* already dead */ }
        }, options.idleTimeoutMs);
      };
      resetIdle();

      childStdout.on('data', (chunk: string) => {
        resetIdle();
        stdout += chunk;
        if (DEBUG) console.log(`${label} stdout chunk (${chunk.length} chars):`, chunk.slice(0, 300));
        options.onStdout?.(chunk);
      });

      childStderr.on('data', (chunk: string) => {
        resetIdle();
        stderr += chunk;
        if (DEBUG) console.log(`${label} stderr chunk:`, chunk.slice(0, 300));
        const filtered = filterNoise(chunk);
        if (filtered.trim()) options.onStderr?.(filtered);
      });

      child.on('error', (err: Error) => {
        clearTimeout(idleTimer);
        console.error(`${label} error:`, err.message);
        this.activeProcess = null;
        reject(err);
      });

      child.on('close', (code: number | null) => {
        clearTimeout(idleTimer);
        console.log(`${label} closed, exit code=${code}, elapsed=${Date.now() - startedAt}ms`);
        childStdout.removeAllListeners();
        childStderr.removeAllListeners();
        this.activeProcess = null;
        resolve(new AgentResult(code ?? -1, stdout, stderr, Date.now() - startedAt));
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.activeProcess) return;
    const child = this.activeProcess;
    this.activeProcess = null; // prevent double-stop

    try {
      if (process.platform === 'win32') {
        // Kill entire process tree on Windows
        spawn('taskkill', ['/F', '/T', '/PID', String(child.pid!)], { shell: false }).unref();
      } else {
        // Kill the whole process group on macOS/Linux (negative PID = process group)
        process.kill(-child.pid!, 'SIGTERM');
      }
    } catch { /* already dead */ }

    await new Promise<void>(resolve => setTimeout(resolve, 3000));

    try {
      if (process.platform !== 'win32') {
        // Windows: already force-killed above with /F flag
        process.kill(-child.pid!, 'SIGKILL');
      }
    } catch { /* already dead */ }
  }

  isRunning(): boolean {
    return this.activeProcess !== null;
  }
}
