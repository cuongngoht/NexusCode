import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import type { AgentSession } from './AgentSession';
import type { AgentSessionStatus } from './AgentSession';
import type { AgentModePolicy } from './AgentModePolicy';
import { AgentCommandGuard, type CommandRisk } from './AgentCommandGuard';
import type { PermissionService } from '../permissions/PermissionService';
import { createPermissionId } from '../permissions/createPermissionId';

export interface AgentTestCommand {
  command: string;
  label: string;
  risk: CommandRisk;
}

export interface AgentTestCommandResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  passed: boolean;
}

export interface AgentTestResult {
  sessionId: string;
  commands: AgentTestCommandResult[];
  passed: boolean;
  startedAt: number;
  completedAt: number;
  durationMs: number;
}

const PREFERRED_SCRIPTS = ['typecheck', 'lint', 'test', 'test:webview', 'compile'];
const MAX_OUTPUT_CHARS = 8000;

export class AgentTestRunner {
  private readonly guard = new AgentCommandGuard();

  async detectCommands(session: AgentSession): Promise<AgentTestCommand[]> {
    const pkgPath = path.join(session.workspaceRoot, 'package.json');
    if (!fs.existsSync(pkgPath)) return [];

    let pkg: Record<string, unknown>;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch {
      return [];
    }

    const scripts = (pkg['scripts'] ?? {}) as Record<string, string>;
    const pm = detectPackageManager(session.workspaceRoot);

    const commands: AgentTestCommand[] = [];
    for (const script of PREFERRED_SCRIPTS) {
      if (scripts[script]) {
        const cmd = `${pm} run ${script}`;
        commands.push({
          command: cmd,
          label: script,
          risk: this.guard.classify(cmd),
        });
      }
    }
    return commands;
  }

  async run(
    session: AgentSession,
    policy: AgentModePolicy,
    permissionService?: PermissionService,
    onStatusChange?: (status: AgentSessionStatus) => void,
  ): Promise<AgentTestResult> {
    const commands = await this.detectCommands(session);
    const startedAt = Date.now();
    const results: AgentTestCommandResult[] = [];
    let allPassed = true;

    for (const testCmd of commands) {
      const risk = this.guard.classify(testCmd.command);
      if (risk === 'blocked') {
        continue;
      }

      if (policy.requireApprovalBeforeTerminal && risk !== 'low') {
        if (permissionService) {
          // Only set waiting_permission when ACTUALLY about to await a decision
          onStatusChange?.('waiting_permission');
          const resolution = await permissionService.request({
            id: createPermissionId(),
            sessionId: session.id,
            subjectType: 'agent',
            subjectId: session.providerId,
            subjectLabel: `@${session.providerId}`,
            actionType: 'terminal.run',
            risk,
            title: `Agent wants to run: ${testCmd.command}`,
            reason: this.guard.explain(testCmd.command),
            command: testCmd.command,
            cwd: session.workspaceRoot,
            createdAt: Date.now(),
          });
          // Resume testing status regardless of decision
          onStatusChange?.('testing');
          if (resolution.decision !== 'approved' && resolution.decision !== 'auto_approved') {
            continue;
          }
        } else {
          continue;
        }
      }

      const result = await runCommand(testCmd.command, session.workspaceRoot);
      results.push(result);

      if (!result.passed) {
        allPassed = false;
        break;
      }
    }

    const completedAt = Date.now();
    return {
      sessionId: session.id,
      commands: results,
      passed: allPassed,
      startedAt,
      completedAt,
      durationMs: completedAt - startedAt,
    };
  }
}

function detectPackageManager(workspaceRoot: string): string {
  if (fs.existsSync(path.join(workspaceRoot, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(workspaceRoot, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(workspaceRoot, 'bun.lockb'))) return 'bun';
  return 'npm';
}

function runCommand(command: string, cwd: string): Promise<AgentTestCommandResult> {
  return new Promise(resolve => {
    const startMs = Date.now();
    const parts = command.split(/\s+/);
    const executable = parts[0];
    const args = parts.slice(1);

    let stdout = '';
    let stderr = '';

    const child = spawn(executable, args, {
      cwd,
      shell: false,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      },
    });

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      if (stdout.length > MAX_OUTPUT_CHARS) {
        stdout = stdout.slice(-MAX_OUTPUT_CHARS);
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > MAX_OUTPUT_CHARS) {
        stderr = stderr.slice(-MAX_OUTPUT_CHARS);
      }
    });

    child.on('close', exitCode => {
      const durationMs = Date.now() - startMs;
      resolve({
        command,
        exitCode: exitCode ?? 1,
        stdout,
        stderr,
        durationMs,
        passed: exitCode === 0,
      });
    });

    child.on('error', err => {
      const durationMs = Date.now() - startMs;
      resolve({
        command,
        exitCode: 1,
        stdout,
        stderr: stderr + '\n' + err.message,
        durationMs,
        passed: false,
      });
    });
  });
}
