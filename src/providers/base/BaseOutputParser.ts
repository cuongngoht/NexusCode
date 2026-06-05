import type { IOutputParser, ParsedActivity } from '../../core/agent/IOutputParser';

const TOOL_ERROR_RE = /^Error executing tool [^:]+:/;

export abstract class BaseOutputParser implements IOutputParser {
  parse(chunk: string): ParsedActivity[] {
    const lines = chunk
      .split('\n')
      .filter(l => l.length > 0 && !TOOL_ERROR_RE.test(l));
    return this.parseLines(lines);
  }

  protected abstract parseLines(lines: string[]): ParsedActivity[];
}
