import { NLOutputParser } from '../base/NLOutputParser';
import type { ParsedActivity, ActivityKind } from '../../core/agent/IOutputParser';

const ANSI_RE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

// "Applying edit to src/app.ts" / "Applied edit to src/app.ts"
const AIDER_APPLY_RE  = /^Applied?\s+edit\s+to\s+(.+)/i;
// "Creating src/foo.ts"
const AIDER_CREATE_RE = /^Creating\s+(.+)/i;
// "Committing ..."
const AIDER_COMMIT_RE = /^Committing\s+(.+)/i;
// "Tokens: 1k sent, 500 received" — metadata, always plain
const AIDER_TOKENS_RE = /^Tokens:/i;

function aiderActivity(line: string): { kind: ActivityKind; label: string } | null {
  let m: RegExpExecArray | null;

  m = AIDER_APPLY_RE.exec(line);
  if (m) return { kind: 'edit', label: `Edit ${m[1].slice(0, 60)}` };

  m = AIDER_CREATE_RE.exec(line);
  if (m) return { kind: 'write', label: `Create ${m[1].slice(0, 60)}` };

  m = AIDER_COMMIT_RE.exec(line);
  if (m) return { kind: 'bash', label: `Commit: ${m[1].slice(0, 55)}` };

  return null;
}

// Extends NLOutputParser — Aider-specific patterns are handled with immediate 'done'
// (since aider announces after the fact: "Applied edit"), everything else uses NL detection.
export class AiderOutputParser extends NLOutputParser {
  protected override parseLines(lines: string[]): ParsedActivity[] {
    const out: ParsedActivity[] = [];
    for (const raw of lines) {
      const line = raw.replace(ANSI_RE, '').trim();
      if (AIDER_TOKENS_RE.test(line)) {
        out.push({ kind: 'plain', status: 'done', label: line, raw });
        continue;
      }
      const aider = aiderActivity(line);
      if (aider) {
        // Aider announces completion after the fact — emit as done directly
        out.push({ kind: aider.kind as ActivityKind, status: 'done', label: aider.label, raw });
        continue;
      }
      // Fall through to NL detection (via parent's parseLines for this single line)
      out.push(...super.parseLines([raw]));
    }
    return out;
  }
}
