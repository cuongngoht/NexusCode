import { BaseOutputParser } from './BaseOutputParser';
import type { ParsedActivity, ActivityKind } from '../../core/agent/IOutputParser';

const ANSI_RE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const MD_LINK_RE = /\[([^\]]+)\]\([^)]+\)/g;

// First-person NL: "I'll read..." / "I will edit..."
const NL_I_RE = /^I(?:'ll| will)\s+(.+)/i;
// Action-verb prefix: "Reading package.json...", "Applying edits to..."
const NL_VERB_RE = /^(Reading|Writing|Editing|Creating|Deleting|Removing|Running|Executing|Searching|Scanning|Analyzing|Checking|Looking|Examining|Installing|Building|Testing|Applying|Fixing|Updating|Fetching|Loading|Saving|Opening|Closing|Generating|Reviewing|Parsing|Processing)\b/i;
// CLI ">" prefix: "> Applying edit to file.ts"
const CLI_GT_RE = /^>\s+(.+)/;

const READ_RE    = /\b(read|open|view|inspect|check|look at|examine|load|fetch|loading|reading|opening)\b/i;
const EDIT_RE    = /\b(edit|update|modify|write|create|add|change|fix|implement|apply|generate|creating|writing|editing|applying|fixing|updating)\b/i;
const BASH_RE    = /\b(run|execute|compile|build|install|test|launch|start|running|executing|building|installing|testing)\b/i;
const SEARCH_RE  = /\b(search|grep|find|look for|scan|scanning|searching|finding)\b/i;

function classifyKind(text: string): ActivityKind {
  if (READ_RE.test(text))   return 'read';
  if (EDIT_RE.test(text))   return 'edit';
  if (BASH_RE.test(text))   return 'bash';
  if (SEARCH_RE.test(text)) return 'search';
  return 'tool_call';
}

function formatLabel(text: string): string {
  const clean = text.replace(MD_LINK_RE, '$1').replace(/\s+/g, ' ').trim();
  return clean.length > 70 ? clean.slice(0, 67) + '…' : clean;
}

function extractActivity(line: string): { kind: ActivityKind; label: string } | null {
  let m: RegExpExecArray | null;

  m = NL_I_RE.exec(line);
  if (m) return { kind: classifyKind(m[1]), label: formatLabel(m[1]) };

  if (NL_VERB_RE.test(line)) return { kind: classifyKind(line), label: formatLabel(line) };

  m = CLI_GT_RE.exec(line);
  if (m) return { kind: classifyKind(m[1]), label: formatLabel(m[1]) };

  return null;
}

// Stateful parser: treats matched NL/action lines as running→done activity transitions.
// Any line not matching an action pattern is emitted as plain text.
export class NLOutputParser extends BaseOutputParser {
  private _pending: { kind: ActivityKind; label: string; raw: string } | null = null;

  protected parseLines(lines: string[]): ParsedActivity[] {
    const out: ParsedActivity[] = [];
    for (const raw of lines) {
      const line = raw.replace(ANSI_RE, '').trim();
      const activity = extractActivity(line);
      if (activity) {
        if (this._pending) {
          out.push({ kind: this._pending.kind, status: 'done', label: this._pending.label, raw: this._pending.raw });
        }
        this._pending = { kind: activity.kind, label: activity.label, raw };
        out.push({ kind: activity.kind, status: 'running', label: activity.label, raw });
      } else {
        out.push({ kind: 'plain' as const, status: 'done' as const, label: line, raw });
      }
    }
    return out;
  }
}
