import { BaseOutputParser } from '../base/BaseOutputParser';
import type { ParsedActivity } from '../../core/agent/IOutputParser';

const ANSI_RE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const CODEX_BANNER_RE = /^OpenAI Codex v[\w.-]+/;
const CODEX_HEADER_SEPARATOR_RE = /^-{4,}$/;
const CODEX_HEADER_FIELD_RE = /^(workdir|model|provider|approval|sandbox|reasoning effort|reasoning summaries|session id):\s/i;
const CODEX_ROLE_RE = /^(user|assistant)$/i;

// State machine for Codex startup suppression.
//
// Codex full output layout:
//   Reading additional input from stdin...
//   OpenAI Codex vX.Y.Z           ← banner
//   --------                       ← sep #1
//   workdir: ...                   ← header fields
//   --------                       ← sep #2  →  conversation echo follows
//   user                           ← role label (suppress entire turn)
//   [enhanced prompt / history]
//   --------                       ← sep #3  →  awaitingRole: check next line
//   assistant                      ← if role, suppress another turn
//   [previous assistant output]
//   --------
//   [ACTUAL RESPONSE]              ← first non-role, non-separator line → show
//
// States: initial → inHeader → awaitingRole ⇄ inConversationTurn → done
type CodexParserState = 'initial' | 'inHeader' | 'awaitingRole' | 'inConversationTurn' | 'done';

export class CodexOutputParser extends BaseOutputParser {
  private state: CodexParserState = 'initial';
  private headerSeparatorsSeen = 0;

  protected parseLines(lines: string[]): ParsedActivity[] {
    const result: ParsedActivity[] = [];

    for (const raw of lines) {
      const line = raw.replace(ANSI_RE, '').trim();

      switch (this.state) {
        case 'done':
          result.push({ kind: 'plain', status: 'done', label: line, raw });
          break;

        case 'initial':
          if (line === 'Reading additional input from stdin...') {
            // suppress
          } else if (CODEX_BANNER_RE.test(line) || CODEX_HEADER_SEPARATOR_RE.test(line) || CODEX_HEADER_FIELD_RE.test(line)) {
            this.state = 'inHeader';
            this.headerSeparatorsSeen = CODEX_HEADER_SEPARATOR_RE.test(line) ? 1 : 0;
          } else {
            // No startup detected — show immediately
            this.state = 'done';
            result.push({ kind: 'plain', status: 'done', label: line, raw });
          }
          break;

        case 'inHeader':
          if (CODEX_HEADER_SEPARATOR_RE.test(line)) {
            this.headerSeparatorsSeen++;
            if (this.headerSeparatorsSeen >= 2) {
              this.state = 'awaitingRole';
            }
          }
          // suppress all header content
          break;

        case 'awaitingRole':
          if (CODEX_ROLE_RE.test(line)) {
            this.state = 'inConversationTurn';
            // suppress role label
          } else if (CODEX_HEADER_SEPARATOR_RE.test(line)) {
            // consecutive separator between turns — suppress, stay here
          } else {
            // First non-role, non-separator line → actual Codex response
            this.state = 'done';
            result.push({ kind: 'plain', status: 'done', label: line, raw });
          }
          break;

        case 'inConversationTurn':
          if (CODEX_HEADER_SEPARATOR_RE.test(line)) {
            // End of conversation turn — check what follows next
            this.state = 'awaitingRole';
          }
          // suppress all turn content (echoed prompt / prior assistant output)
          break;
      }
    }

    return result;
  }
}
