import { spawn, ChildProcess } from 'child_process';
import { CliCommand } from '../core/types';
import { globalBus } from '../core/eventBus';
import { CommandGuard } from './commandGuard';

export class ProcessRunner {
  private activeProcess: ChildProcess | null = null;
  private activeTaskId: string | null = null;

  run(taskId: string, command: CliCommand, cwd: string): void {
    if (this.activeProcess) {
      throw new Error('A task is already running. Stop it before starting a new one.');
    }

    CommandGuard.validate(command.command);

    const child = spawn(command.command, command.args, {
      cwd,
      shell: false,
      env: process.env,
    });

    this.activeProcess = child;
    this.activeTaskId = taskId;

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', (chunk: string) => {
      globalBus.emit({ kind: 'stdout', taskId, payload: chunk });
    });

    child.stderr.on('data', (chunk: string) => {
      globalBus.emit({ kind: 'stderr', taskId, payload: chunk });
    });

    child.on('error', (err: Error) => {
      this.cleanup();
      globalBus.emit({ kind: 'task_error', taskId, payload: { message: err.message } });
    });

    child.on('close', (code: number | null) => {
      const wasActive = this.activeTaskId === taskId;
      this.cleanup();
      if (wasActive) {
        globalBus.emit({
          kind: 'task_completed',
          taskId,
          payload: { exitCode: code ?? -1 },
        });
      }
    });
  }

  stop(taskId: string): boolean {
    if (!this.activeProcess || this.activeTaskId !== taskId) {
      return false;
    }
    this.activeProcess.kill('SIGTERM');
    setTimeout(() => {
      if (this.activeProcess && this.activeTaskId === taskId) {
        this.activeProcess.kill('SIGKILL');
      }
    }, 3000);
    this.cleanup();
    globalBus.emit({ kind: 'task_stopped', taskId });
    return true;
  }

  isRunning(): boolean {
    return this.activeProcess !== null;
  }

  private cleanup(): void {
    this.activeProcess = null;
    this.activeTaskId = null;
  }
}
