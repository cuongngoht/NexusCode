import type { IOutputParser, ParsedActivity } from '../../core/agent/IOutputParser';

// TODO: Add Codex-specific activity patterns once CLI output format is documented.
export class CodexOutputParser implements IOutputParser {
  parse(chunk: string): ParsedActivity[] {
    return chunk
      .split('\n')
      .filter(l => l.length > 0)
      .map(line => ({ kind: 'plain' as const, status: 'done' as const, label: line, raw: line }));
  }
}
