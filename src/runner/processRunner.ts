import { spawn, ChildProcess } from 'child_process';
import { AgentCommand, AgentResult } from '../core/agent';
import type { IProcessRunner, RunOptions } from '../core/runner/IProcessRunner';
import { CommandGuard } from './commandGuard';

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
        env: { ...process.env, ...(command.env ?? {}) },
      });

      this.activeProcess = child;

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      child.stdout.on('data', (chunk: string) => {
        stdout += chunk;
        options.onStdout?.(chunk);
      });

      child.stderr.on('data', (chunk: string) => {
        stderr += chunk;
        options.onStderr?.(chunk);
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
