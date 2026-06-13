import * as fs from 'fs';
import * as path from 'path';
import type { ReActAction, ReActObservation, ReActResult } from './ReActTypes';
import type { DebugChainContext } from '../orchestrator/DebugChainContext';
import { assessDebugCommand } from '../tools/SafeCommandPolicy';
import { runDiagnosticCommand } from '../tools/DebugToolRunner';
import { collectWorkspaceFiles } from '../search/WorkspaceFileCollector';
import { tokenize } from '../search/Bm25Tokenizer';

const MAX_FILE_SNIPPET_LINES = 80;
const MAX_SEARCH_RESULTS = 10;

/**
 * Deterministic ReAct investigation loop.
 *
 * MVP is deterministic (no LLM feedback), structured as:
 *   Round 1: Read selected files around stack trace lines.
 *   Round 2: Search exact error tokens / import/export / function names.
 *   Round 3: Inspect config / package / test files.
 *   Round 4: Run safe diagnostic command if available and allowed.
 *   Final: Produce evidence + suspected root cause + confidence.
 *
 * INVARIANT: This loop never edits files.
 */
export class ReActLoop {
  private readonly observations: ReActObservation[] = [];

  constructor(private readonly maxRounds: number) {}

  async run(ctx: DebugChainContext): Promise<ReActResult> {
    if (ctx.cancelled) {
      return { evidence: [], confidence: ctx.signal?.confidence ?? 0.2 };
    }
    const effectiveRounds = Math.min(this.maxRounds, 4);

    for (let round = 1; round <= effectiveRounds; round++) {
      if (ctx.cancelled) break;
      const action = this.planAction(round, ctx);
      if (!action) break;
      const observation = await this.executeAction(action, ctx);
      this.observations.push({ round, action, observation });
      if (ctx.cancelled) break;
    }

    return this.buildResult(ctx);
  }

  private planAction(round: number, ctx: DebugChainContext): ReActAction | null {
    switch (round) {
      case 1:
        // Read primary error source files
        if (ctx.signal && ctx.signal.files.length > 0) {
          const ref = ctx.signal.files[0];
          return {
            type: 'read_file',
            path: ref.path,
            startLine: ref.line ? Math.max(1, ref.line - 10) : undefined,
            endLine: ref.line ? ref.line + 20 : undefined,
          };
        }
        // Fallback: read top BM25 result
        if (ctx.selectedFiles.length > 0) {
          return { type: 'read_file', path: ctx.selectedFiles[0] };
        }
        return null;

      case 2: {
        // Search for error tokens in the workspace
        const tokens = this.buildSearchTokens(ctx);
        if (tokens.length === 0) return null;
        return {
          type: 'search_text',
          query: tokens.slice(0, 5).join(' '),
          paths: ctx.selectedFiles.slice(0, 10),
        };
      }

      case 3: {
        // Inspect config / package.json / test files
        const configTarget = this.findConfigOrTestFile(ctx);
        if (configTarget) {
          return { type: 'read_file', path: configTarget };
        }
        // Fallback: read second selected file
        if (ctx.selectedFiles.length > 1) {
          return { type: 'read_file', path: ctx.selectedFiles[1] };
        }
        return null;
      }

      case 4: {
        // Run safe diagnostic command if available
        if (!ctx.verificationCommand) return null;
        const decision = assessDebugCommand(ctx.verificationCommand);
        if (!decision.allowed) return null;
        return { type: 'run_diagnostic_command', command: ctx.verificationCommand };
      }

      default:
        return null;
    }
  }

  private async executeAction(action: ReActAction, ctx: DebugChainContext): Promise<string> {
    switch (action.type) {
      case 'read_file':
        return this.readFile(action.path, ctx.workspaceRoot, action.startLine, action.endLine);

      case 'search_text':
        return this.searchText(action.query, action.paths ?? [], ctx.workspaceRoot);

      case 'list_related_files':
        return this.listRelatedFiles(action.path, ctx.workspaceRoot);

      case 'run_diagnostic_command': {
        const decision = assessDebugCommand(action.command);
        if (!decision.allowed) {
          return `[BLOCKED] Command not allowed by safe command policy: ${decision.reason}`;
        }
        const result = runDiagnosticCommand(action.command, ctx.workspaceRoot);
        const output = [result.stdout, result.stderr].filter(Boolean).join('\n').slice(0, 2000);
        return `Exit code: ${result.exitCode}\n${output}`;
      }
    }
  }

  private readFile(filePath: string, workspaceRoot: string, startLine?: number, endLine?: number): string {
    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(workspaceRoot, filePath);

    try {
      const content = fs.readFileSync(absPath, 'utf8');
      const lines = content.split('\n');

      if (startLine !== undefined && endLine !== undefined) {
        const start = Math.max(0, startLine - 1);
        const end = Math.min(lines.length, endLine);
        const snippet = lines.slice(start, end).map((l, i) => `${start + i + 1}: ${l}`).join('\n');
        return `[${filePath}:${startLine}-${endLine}]\n${snippet}`;
      }

      // Return first N lines
      const snippet = lines.slice(0, MAX_FILE_SNIPPET_LINES).map((l, i) => `${i + 1}: ${l}`).join('\n');
      return `[${filePath}]\n${snippet}`;
    } catch {
      return `[Could not read file: ${filePath}]`;
    }
  }

  private searchText(query: string, limitedPaths: string[], workspaceRoot: string): string {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return '[No search tokens derived from query]';

    const searchPaths = limitedPaths.length > 0
      ? limitedPaths
      : collectWorkspaceFiles(workspaceRoot).slice(0, 50).map(f => f.relativePath);

    const matches: string[] = [];

    for (const relPath of searchPaths.slice(0, MAX_SEARCH_RESULTS)) {
      const absPath = path.join(workspaceRoot, relPath);
      try {
        const content = fs.readFileSync(absPath, 'utf8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].toLowerCase();
          if (queryTokens.some(t => line.includes(t))) {
            matches.push(`${relPath}:${i + 1}: ${lines[i].trim().slice(0, 120)}`);
            if (matches.length >= MAX_SEARCH_RESULTS * 3) break;
          }
        }
      } catch {
        // non-fatal
      }
      if (matches.length >= MAX_SEARCH_RESULTS * 3) break;
    }

    if (matches.length === 0) {
      return `[No matches found for query: "${query}"]`;
    }
    return matches.slice(0, MAX_SEARCH_RESULTS * 2).join('\n');
  }

  private listRelatedFiles(filePath: string, workspaceRoot: string): string {
    const dir = path.dirname(path.join(workspaceRoot, filePath));
    try {
      const entries = fs.readdirSync(dir);
      return entries.slice(0, 20).join('\n');
    } catch {
      return `[Could not list directory for: ${filePath}]`;
    }
  }

  private findConfigOrTestFile(ctx: DebugChainContext): string | undefined {
    // Prefer config files from strategy results
    const configFiles = ctx.strategyResults
      .filter(r => {
        const base = path.basename(r.path);
        return base.startsWith('tsconfig') ||
          base.startsWith('vite.config') ||
          base.startsWith('vitest.config') ||
          base.startsWith('jest.config') ||
          base === 'package.json';
      })
      .map(r => r.path);

    if (configFiles.length > 0) return configFiles[0];

    // Fallback: test files
    const testFiles = ctx.selectedFiles.filter(f => /\.test\.|\.spec\.|__tests__/.test(f));
    return testFiles[0];
  }

  private buildSearchTokens(ctx: DebugChainContext): string[] {
    if (!ctx.signal) return [];

    const tokens: string[] = [];

    // Error codes
    const codes = ctx.signal.raw.match(/\b[A-Z]{1,4}\d{3,6}\b/g) ?? [];
    tokens.push(...codes);

    // File basenames without extension
    for (const ref of ctx.signal.files) {
      const base = path.basename(ref.path, path.extname(ref.path));
      if (base) tokens.push(base);
    }

    // Tool names
    tokens.push(...ctx.signal.suspectedTools);

    return [...new Set(tokens)];
  }

  private buildResult(ctx: DebugChainContext): ReActResult {
    const evidence: string[] = [];

    for (const obs of this.observations) {
      if (!obs.observation.includes('[Could not') && !obs.observation.includes('[BLOCKED]')) {
        const summary = `Round ${obs.round} (${obs.action.type}): ${obs.observation.slice(0, 300)}`;
        evidence.push(summary);
      }
    }

    // Add any existing evidence from ctx
    for (const e of ctx.evidence) {
      if (!evidence.includes(e)) evidence.push(e);
    }

    // Derive a basic root cause hypothesis from signal
    let suspectedRootCause: string | undefined;
    let confidence = ctx.signal?.confidence ?? 0.2;

    if (ctx.signal && ctx.signal.kind !== 'unknown') {
      const kind = ctx.signal.kind;
      const files = ctx.signal.files.map(f => f.path).slice(0, 2).join(', ');
      const tools = ctx.signal.suspectedTools.slice(0, 2).join(', ');

      switch (kind) {
        case 'type-error':
          suspectedRootCause = `TypeScript type mismatch${files ? ` in ${files}` : ''}. ${tools ? `Tools: ${tools}.` : ''} Inspect the specific line indicated by the error code.`;
          confidence = Math.max(confidence, 0.6);
          break;
        case 'stack-trace':
          suspectedRootCause = `Runtime error at ${files || 'unknown file'}. Check the null/undefined access or missing initialization shown in the stack trace.`;
          confidence = Math.max(confidence, 0.55);
          break;
        case 'test-failure':
          suspectedRootCause = `Test assertion failure${files ? ` in ${files}` : ''}. The implementation may not match the expected behavior.`;
          confidence = Math.max(confidence, 0.5);
          break;
        case 'build-error':
          suspectedRootCause = `Build failure${tools ? ` with ${tools}` : ''}. Check the build configuration and any recently changed files.`;
          confidence = Math.max(confidence, 0.5);
          break;
        default:
          suspectedRootCause = 'Unable to determine root cause with high confidence from the provided error. Manual investigation recommended.';
          confidence = Math.min(confidence, 0.3);
      }
    }

    if (evidence.length > 2) {
      confidence = Math.min(confidence + 0.1, 0.9);
    }

    return { evidence, suspectedRootCause, confidence };
  }
}
