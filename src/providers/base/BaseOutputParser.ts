import type { IOutputParser, ParsedActivity } from '../../core/agent/IOutputParser';

const TOOL_ERROR_RE = /^Error executing tool [^:]+:/;

export abstract class BaseOutputParser implements IOutputParser {
  private _lineBuffer = '';

  parse(chunk: string): ParsedActivity[] {
    const combined = this._lineBuffer + chunk;
    const parts = combined.split('\n');
    // Last element is either empty (chunk ended with \n) or a partial line
    this._lineBuffer = parts.pop() ?? '';
    const lines = parts.filter(l => l.length > 0 && !TOOL_ERROR_RE.test(l));
    return this.parseLines(lines);
  }

  protected abstract parseLines(lines: string[]): ParsedActivity[];
}
