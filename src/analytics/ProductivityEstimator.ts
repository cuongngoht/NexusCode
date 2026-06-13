import { spawnSync } from 'child_process';

export interface ProductivityEstimate {
  filesChanged: number;
  linesAdded: number;
  linesDeleted: number;
  testsGenerated: number;
  bugsFixed: number;
  estimatedTimeSavedMinutes: number;
}

const MODE_MULTIPLIERS: Record<string, number> = {
  debug:    1.4,
  test:     1.2,
  edit:     1.0,
  research: 0.7,
};

const DEFAULT_MULTIPLIER = 0.5;
const MAX_TIME_SAVED = 240;

const TEST_FILE_PATTERNS = ['.test.', '.spec.', '__tests__', 'test/', 'tests/'];

function isTestFile(path: string): boolean {
  return TEST_FILE_PATTERNS.some(p => path.includes(p));
}

export class ProductivityEstimator {
  constructor(private readonly workspaceRoot: string) {}

  async estimate(mode: string): Promise<ProductivityEstimate> {
    try {
      return this.runGitDiff(mode);
    } catch {
      return this.zeros();
    }
  }

  private runGitDiff(mode: string): ProductivityEstimate {
    // Get list of changed files
    const statResult = spawnSync(
      'git',
      ['diff', '--stat', 'HEAD'],
      { cwd: this.workspaceRoot, encoding: 'utf8', timeout: 5000, shell: false },
    );

    if (statResult.status !== 0 || !statResult.stdout) {
      // No HEAD or no diff — try staged diff
      const stagedResult = spawnSync(
        'git',
        ['diff', '--cached', '--stat'],
        { cwd: this.workspaceRoot, encoding: 'utf8', timeout: 5000, shell: false },
      );
      if (stagedResult.status !== 0 || !stagedResult.stdout) {
        return this.zeros();
      }
      return this.parseDiffStat(stagedResult.stdout, mode);
    }

    return this.parseDiffStat(statResult.stdout, mode);
  }

  private parseDiffStat(statOutput: string, mode: string): ProductivityEstimate {
    const lines = statOutput.split('\n');
    let filesChanged = 0;
    let linesAdded = 0;
    let linesDeleted = 0;
    let testsGenerated = 0;

    for (const line of lines) {
      // Skip summary line like "5 files changed, 120 insertions(+), 30 deletions(-)"
      if (line.includes('files changed') || line.includes('file changed')) {
        const addMatch = line.match(/(\d+) insertion/);
        const delMatch = line.match(/(\d+) deletion/);
        if (addMatch) linesAdded += parseInt(addMatch[1], 10);
        if (delMatch) linesDeleted += parseInt(delMatch[1], 10);
        continue;
      }
      // Individual file lines like " src/foo.ts | 12 ++"
      const fileMatch = line.match(/^\s+(.+?)\s+\|\s+(\d+)/);
      if (fileMatch) {
        filesChanged += 1;
        const filePath = fileMatch[1].trim();
        if (isTestFile(filePath)) {
          const lineCount = parseInt(fileMatch[2], 10) || 0;
          // Count each test file's added lines as potentially generating tests
          testsGenerated += Math.floor(lineCount / 10);
        }
      }
    }

    const multiplier = MODE_MULTIPLIERS[mode] ?? DEFAULT_MULTIPLIER;
    const raw =
      filesChanged * 4 +
      linesAdded * 0.15 +
      linesDeleted * 0.08 +
      testsGenerated * 8;

    const estimatedTimeSavedMinutes = Math.min(MAX_TIME_SAVED, Math.round(raw * multiplier));

    return {
      filesChanged,
      linesAdded,
      linesDeleted,
      testsGenerated,
      bugsFixed: mode === 'debug' && filesChanged > 0 ? 1 : 0,
      estimatedTimeSavedMinutes,
    };
  }

  private zeros(): ProductivityEstimate {
    return {
      filesChanged: 0,
      linesAdded: 0,
      linesDeleted: 0,
      testsGenerated: 0,
      bugsFixed: 0,
      estimatedTimeSavedMinutes: 0,
    };
  }
}
