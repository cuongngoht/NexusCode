import { BaseOutputParser } from '../base/BaseOutputParser';
import type { ParsedActivity, ActivityKind } from '../../core/agent/IOutputParser';

const ANSI_RE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

// Extract display name from markdown link: [label](url) → label, else raw text
const MD_LINK_RE = /\[([^\]]+)\]\([^)]+\)/g;
function stripMdLinks(text: string): string {
  return text.replace(MD_LINK_RE, '$1');
}

// agy streams natural-language lines describing what it's doing, e.g.:
//   "I will read [package.json](file:///...) to see the scripts"
//   "I'll run the tests using npm run test:webview"
const AGY_LINE_RE = /^I(?:'ll| will)\s+(.+)/i;

const READ_RE    = /\b(read|open|view|inspect|check|look at|examine)\b/i;
const EDIT_RE    = /\b(edit|update|modify|write|create|add|change|fix|implement)\b/i;
const BASH_RE    = /\b(run|execute|compile|build|install|test|launch|start)\b/i;
const SEARCH_RE  = /\b(search|grep|find|look for|scan)\b/i;

function classifyKind(action: string): ActivityKind {
  if (READ_RE.test(action))   return 'read';
  if (EDIT_RE.test(action))   return 'edit';
  if (BASH_RE.test(action))   return 'bash';
  if (SEARCH_RE.test(action)) return 'search';
  return 'tool_call';
}

function formatLabel(action: string): string {
  const clean = stripMdLinks(action).replace(/\s+/g, ' ').trim();
  return clean.length > 70 ? clean.slice(0, 67) + '…' : clean;
}

export class AntigravityOutputParser extends BaseOutputParser {
  private _pending: { kind: ActivityKind; label: string; raw: string } | null = null;

  protected parseLines(lines: string[]): ParsedActivity[] {
    const out: ParsedActivity[] = [];
    for (const raw of lines) {
      const line = raw.replace(ANSI_RE, '').trim();
      const m = AGY_LINE_RE.exec(line);
      if (m) {
        if (this._pending) {
          out.push({ kind: this._pending.kind, status: 'done', label: this._pending.label, raw: this._pending.raw });
        }
        const action = m[1];
        const next = { kind: classifyKind(action), label: formatLabel(action), raw };
        this._pending = next;
        out.push({ kind: next.kind, status: 'running', label: next.label, raw });
      } else {
        out.push({ kind: 'plain' as const, status: 'done' as const, label: line, raw });
      }
    }
    return out;
  }
}
