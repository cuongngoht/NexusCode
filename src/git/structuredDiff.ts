export type DiffFileStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'unknown';

export interface DiffLine {
  type: 'context' | 'add' | 'remove';
  oldLine?: number;
  newLine?: number;
  content: string;
}

export interface DiffHunk {
  id: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: DiffLine[];
}

export interface FileDiffSummary {
  path: string;
  oldPath?: string;
  status: DiffFileStatus;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
  isBinary?: boolean;
  isTooLarge?: boolean;
  rawDiff?: string;
}

const MAX_DIFF_SIZE = 500_000; // chars
const HUNK_HEADER_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)/;

function parseHunk(
  lines: string[],
  startIdx: number,
  fileIndex: number,
  hunkIndex: number,
): { hunk: DiffHunk; nextIdx: number } {
  const headerLine = lines[startIdx];
  const m = HUNK_HEADER_RE.exec(headerLine);
  if (!m) {
    return {
      hunk: {
        id: `f${fileIndex}-h${hunkIndex}`,
        oldStart: 0, oldLines: 0, newStart: 0, newLines: 0,
        header: headerLine, lines: [],
      },
      nextIdx: startIdx + 1,
    };
  }

  const oldStart = parseInt(m[1], 10);
  const oldLines = m[2] !== undefined ? parseInt(m[2], 10) : 1;
  const newStart = parseInt(m[3], 10);
  const newLines = m[4] !== undefined ? parseInt(m[4], 10) : 1;
  const header = headerLine;

  const diffLines: DiffLine[] = [];
  let oldCur = oldStart;
  let newCur = newStart;
  let idx = startIdx + 1;

  while (idx < lines.length) {
    const l = lines[idx];
    if (l.startsWith('@@') || l.startsWith('diff --git') || l.startsWith('--- ') || l.startsWith('+++ ')) break;
    if (l.startsWith('+')) {
      diffLines.push({ type: 'add', newLine: newCur++, content: l.slice(1) });
    } else if (l.startsWith('-')) {
      diffLines.push({ type: 'remove', oldLine: oldCur++, content: l.slice(1) });
    } else if (l.startsWith('\\')) {
      // "\ No newline at end of file" — skip
    } else {
      const content = l.startsWith(' ') ? l.slice(1) : l;
      diffLines.push({ type: 'context', oldLine: oldCur++, newLine: newCur++, content });
    }
    idx++;
  }

  return {
    hunk: {
      id: `f${fileIndex}-h${hunkIndex}`,
      oldStart, oldLines, newStart, newLines, header, lines: diffLines,
    },
    nextIdx: idx,
  };
}

export function parseUnifiedDiff(rawDiff: string): FileDiffSummary[] {
  if (rawDiff.length > MAX_DIFF_SIZE) {
    return [{
      path: 'diff',
      status: 'unknown',
      additions: 0,
      deletions: 0,
      hunks: [],
      isTooLarge: true,
      rawDiff: rawDiff.slice(0, 200) + '\n...(truncated)',
    }];
  }

  const lines = rawDiff.split('\n');
  const results: FileDiffSummary[] = [];
  let i = 0;
  let fileIndex = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.startsWith('diff --git')) { i++; continue; }

    // Parse file header
    let path = '';
    let oldPath: string | undefined;
    let status: DiffFileStatus = 'modified';
    let isBinary = false;

    // Skip to --- / +++ lines
    i++;
    while (i < lines.length && !lines[i].startsWith('--- ') && !lines[i].startsWith('diff --git')) {
      const l = lines[i];
      if (l.startsWith('new file mode')) status = 'added';
      else if (l.startsWith('deleted file mode')) status = 'deleted';
      else if (l.startsWith('rename from ')) oldPath = l.slice('rename from '.length);
      else if (l.startsWith('rename to ')) { path = l.slice('rename to '.length); status = 'renamed'; }
      else if (l.startsWith('copy from ')) oldPath = l.slice('copy from '.length);
      else if (l.startsWith('copy to ')) { path = l.slice('copy to '.length); status = 'copied'; }
      else if (l.includes('Binary files')) isBinary = true;
      i++;
    }

    if (lines[i]?.startsWith('--- ')) {
      const fromPath = lines[i].slice(4).trim().replace(/^a\//, '');
      if (!oldPath && fromPath !== '/dev/null') oldPath = fromPath;
      i++;
    }
    if (lines[i]?.startsWith('+++ ')) {
      const toPath = lines[i].slice(4).trim().replace(/^b\//, '');
      if (!path) path = toPath;
      if (!path || path === '/dev/null') path = oldPath ?? 'unknown';
      i++;
    }

    if (!path) { path = 'unknown'; }

    const hunks: DiffHunk[] = [];
    let additions = 0;
    let deletions = 0;
    let hunkIndex = 0;

    if (!isBinary) {
      while (i < lines.length && !lines[i].startsWith('diff --git')) {
        if (lines[i].startsWith('@@')) {
          const { hunk, nextIdx } = parseHunk(lines, i, fileIndex, hunkIndex++);
          for (const l of hunk.lines) {
            if (l.type === 'add') additions++;
            else if (l.type === 'remove') deletions++;
          }
          hunks.push(hunk);
          i = nextIdx;
        } else {
          i++;
        }
      }
    }

    results.push({ path, oldPath, status, additions, deletions, hunks, isBinary: isBinary || undefined });
    fileIndex++;
  }

  return results;
}
