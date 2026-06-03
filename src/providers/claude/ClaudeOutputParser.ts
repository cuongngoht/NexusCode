import type { IOutputParser, ParsedActivity, ActivityKind } from '../../core/agent/IOutputParser';

// Strip ANSI escape sequences from a string
const ANSI_RE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

// Claude CLI tool call line patterns:
//   ⏺ ToolName(args...)   → running
//   ✓ ToolName(args...)   → done
//   ✗ ToolName(args...)   → error
// Also handles bold/color ANSI variants where symbol may be wrapped.
const RUNNING_RE = /^[⏺●•◆]\s+(\w+)\((.{0,200})\)/u;
const DONE_RE    = /^[✓✔☑]\s+(\w+)\((.{0,200})\)/u;
const ERROR_RE   = /^[✗✘×☒]\s+(\w+)\((.{0,200})\)/u;

const TOOL_KIND_MAP: Record<string, ActivityKind> = {
  Read: 'read', View: 'read',
  Edit: 'edit', MultiEdit: 'edit', NotebookEdit: 'edit',
  Write: 'write',
  Bash: 'bash', Shell: 'bash',
  TodoWrite: 'todo', TodoRead: 'todo',
  WebSearch: 'search', WebFetch: 'search',
};

function toolKind(name: string): ActivityKind {
  return TOOL_KIND_MAP[name] ?? 'tool_call';
}

function formatLabel(toolName: string, args: string): string {
  const raw = args.trim();
  // For file-oriented tools, keep only the first argument (the path)
  if (['Read', 'View', 'Edit', 'MultiEdit', 'Write', 'NotebookEdit'].includes(toolName)) {
    const firstArg = raw.split(',')[0].trim().replace(/^["']|["']$/g, '');
    return firstArg.length > 60 ? '…' + firstArg.slice(-57) : firstArg;
  }
  // For bash, truncate long commands
  const cleaned = raw.replace(/^["']|["']$/g, '');
  return cleaned.length > 60 ? cleaned.slice(0, 57) + '…' : cleaned;
}

export class ClaudeOutputParser implements IOutputParser {
  parse(chunk: string): ParsedActivity[] {
    return chunk
      .split('\n')
      .filter(l => l.length > 0)
      .map(line => this.parseLine(line));
  }

  private parseLine(raw: string): ParsedActivity {
    const line = raw.replace(ANSI_RE, '').trim();

    const running = RUNNING_RE.exec(line);
    if (running) {
      return {
        kind: toolKind(running[1]),
        status: 'running',
        label: formatLabel(running[1], running[2]),
        raw,
      };
    }

    const done = DONE_RE.exec(line);
    if (done) {
      return {
        kind: toolKind(done[1]),
        status: 'done',
        label: formatLabel(done[1], done[2]),
        raw,
      };
    }

    const error = ERROR_RE.exec(line);
    if (error) {
      return {
        kind: toolKind(error[1]),
        status: 'error',
        label: formatLabel(error[1], error[2]),
        raw,
      };
    }

    return { kind: 'plain', status: 'done', label: line, raw };
  }
}
