import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import type { IPipelineStep } from '../../core/pipeline/IPipelineStep';
import type { PipelineContext } from '../../core/pipeline/PipelineContext';
import { parseDebugInput, hasNoEditFlag } from '../../debug/DebugInputParser';
import type { DebugContext } from '../../debug/DebugContext';

function loadPackageScripts(workspaceRoot: string): Record<string, string> {
  try {
    const pkgPath = path.join(workspaceRoot, 'package.json');
    const raw = fs.readFileSync(pkgPath, 'utf8');
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    const scripts = pkg['scripts'];
    if (scripts && typeof scripts === 'object') {
      return scripts as Record<string, string>;
    }
  } catch {
    // no package.json
  }
  return {};
}

function getGitChangedFiles(workspaceRoot: string): string[] {
  try {
    const result = spawnSync('git', ['status', '--porcelain'], {
      cwd: workspaceRoot,
      encoding: 'utf8',
      timeout: 5000,
      shell: false,
    });
    if (result.status !== 0 || result.error) return [];
    return (result.stdout ?? '')
      .split('\n')
      .filter(l => l.length >= 3)
      .map(l => l.substring(3).trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export class DebugPreStep implements IPipelineStep {
  readonly label = 'debug-prepare';

  async execute(ctx: PipelineContext, _emit: (e: import('../../core/events/IEventBus').NexusEvent) => void): Promise<void> {
    const signal = parseDebugInput(ctx.originalPrompt);
    const noEdit = hasNoEditFlag(ctx.originalPrompt);
    const packageScripts = loadPackageScripts(ctx.workspaceRoot);
    const gitChangedFiles = getGitChangedFiles(ctx.workspaceRoot);

    const failingCommand = signal.command;

    const debugCtx: DebugContext = {
      signal,
      selectedFiles: signal.files.map(f => f.path),
      failingCommand,
      packageScripts,
      gitChangedFiles,
      noEdit,
      addRegressionTest: true,
      rerunAfterFix: !!failingCommand,
      checkpoint: false,
      asyncMode: /\b(async|race|concurrent|flaky|timeout|debounce|throttle)\b/i.test(ctx.originalPrompt),
    };

    ctx.debugContext = debugCtx;
  }
}
