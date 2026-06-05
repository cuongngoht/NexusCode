import { BaseOutputParser } from './BaseOutputParser';
import type { ParsedActivity } from '../../core/agent/IOutputParser';

export class DefaultOutputParser extends BaseOutputParser {
  protected parseLines(lines: string[]): ParsedActivity[] {
    return lines.map(line => ({ kind: 'plain' as const, status: 'done' as const, label: line, raw: line }));
  }
}
