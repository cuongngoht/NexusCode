import type { DebugSignal, DebugSignalKind, DebugFileRef } from './DebugContext';

// Patterns for stack trace file references (JS/TS/Node/Vite)
const STACK_FILE_RE = /(?:at\s+\S+\s+\(|^\s+at\s+)([^\s(]+?\.[jt]sx?):(\d+)(?::(\d+))?/gm;
const STACK_FILE_ANON_RE = /\bat\s+([^\s(]+\.[jt]sx?):(\d+)(?::(\d+))?/gm;

// TypeScript compiler errors: src/foo.ts(10,5): error TS2345
const TS_ERROR_RE = /([^\s('"]+\.tsx?)\((\d+),(\d+)\):\s+(?:error|warning)\s+(TS\d+)/gm;

// Failing command heuristic: lines starting with $, >, npm, npx, pnpm, yarn, node, bun
const COMMAND_RE = /^(?:\$\s+|>\s+)?((?:npm|npx|pnpm|yarn|bun|node|vitest|jest|tsc|eslint|vite)\s+\S.*?)$/m;

const TOOL_HINTS: Array<{ pattern: RegExp; tool: string }> = [
  { pattern: /vitest/i, tool: 'vitest' },
  { pattern: /jest/i, tool: 'jest' },
  { pattern: /\bTS\d{4}\b|typescript|tsc\b/i, tool: 'typescript' },
  { pattern: /eslint/i, tool: 'eslint' },
  { pattern: /vite\b/i, tool: 'vite' },
  { pattern: /rollup/i, tool: 'rollup' },
  { pattern: /\bnode\b/i, tool: 'node' },
  { pattern: /\bbun\b/i, tool: 'bun' },
];

function dedupFiles(refs: DebugFileRef[]): DebugFileRef[] {
  const seen = new Set<string>();
  return refs.filter(r => {
    const key = `${r.path}:${r.line ?? ''}:${r.column ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseFiles(raw: string): DebugFileRef[] {
  const refs: DebugFileRef[] = [];

  // TypeScript compiler errors first (highest confidence)
  let m: RegExpExecArray | null;
  TS_ERROR_RE.lastIndex = 0;
  while ((m = TS_ERROR_RE.exec(raw)) !== null) {
    refs.push({ path: m[1], line: parseInt(m[2], 10), column: parseInt(m[3], 10) });
  }

  // JS/TS stack trace references
  STACK_FILE_RE.lastIndex = 0;
  while ((m = STACK_FILE_RE.exec(raw)) !== null) {
    const ref: DebugFileRef = { path: m[1] };
    if (m[2]) ref.line = parseInt(m[2], 10);
    if (m[3]) ref.column = parseInt(m[3], 10);
    refs.push(ref);
  }

  STACK_FILE_ANON_RE.lastIndex = 0;
  while ((m = STACK_FILE_ANON_RE.exec(raw)) !== null) {
    const ref: DebugFileRef = { path: m[1] };
    if (m[2]) ref.line = parseInt(m[2], 10);
    if (m[3]) ref.column = parseInt(m[3], 10);
    refs.push(ref);
  }

  // Filter out node_modules and http paths
  const filtered = refs.filter(r => !r.path.includes('node_modules') && !r.path.startsWith('http'));
  return dedupFiles(filtered);
}

function detectKind(raw: string, suspectedTools: string[]): DebugSignalKind {
  if (/\bTS\d{4}\b|Type '.*?' is not assignable|Object is (possibly|of type) '(null|undefined)'/.test(raw)) {
    return 'type-error';
  }
  if (/\b(vite|rollup)\b.*error|Build failed|Failed to compile/i.test(raw)) {
    return 'build-error';
  }
  if (
    suspectedTools.includes('vitest') ||
    suspectedTools.includes('jest') ||
    /\bexpect\(|AssertionError|● |FAIL\s+src\//i.test(raw)
  ) {
    return 'test-failure';
  }
  if (/\bat\s+\S+\s*\(?\S+:[0-9]+|Error:\s+\S|TypeError:|ReferenceError:|SyntaxError:/m.test(raw)) {
    return 'stack-trace';
  }
  if (/^[A-Z][a-z]+Error:|^\s+at\s+/m.test(raw)) {
    return 'terminal-output';
  }
  return 'unknown';
}

function detectSuspectedTools(raw: string): string[] {
  const tools: string[] = [];
  for (const { pattern, tool } of TOOL_HINTS) {
    if (pattern.test(raw) && !tools.includes(tool)) {
      tools.push(tool);
    }
  }
  return tools;
}

function detectCommand(raw: string): string | undefined {
  const m = raw.match(COMMAND_RE);
  return m ? m[1].trim() : undefined;
}

function scoreConfidence(kind: DebugSignalKind, files: DebugFileRef[], tools: string[]): number {
  if (kind === 'unknown') return 0.2;
  let score = 0.4;
  if (files.length > 0) score += 0.3;
  if (tools.length > 0) score += 0.2;
  if (kind === 'stack-trace' || kind === 'type-error') score += 0.1;
  return Math.min(score, 1.0);
}

export function parseDebugInput(raw: string): DebugSignal {
  const suspectedTools = detectSuspectedTools(raw);
  const files = parseFiles(raw);
  const command = detectCommand(raw);
  const kind = detectKind(raw, suspectedTools);
  const confidence = scoreConfidence(kind, files, suspectedTools);

  return { raw, kind, files, command, suspectedTools, confidence };
}

export function hasNoEditFlag(raw: string): boolean {
  return /\bno[- ]?edit\b/i.test(raw);
}
