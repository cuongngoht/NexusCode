// CLI (stdio) terminal output parser — State Pattern for startup banner suppression.
// NOT for SSE transport. Use CodexSseAdapter for OpenAI HTTP streaming.
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

export class CodexCliOutputParser extends BaseOutputParser {
  private state: CodexParserState = 'initial';
  private headerSeparatorsSeen = 0;

  protected parseLines(lines: string[]): ParsedActivity[] {
    const result: ParsedActivity[] = [];

    for (const raw of lines) {
      // Strip ANSI codes, then take only the content after the last \r.
      // Codex CLI uses a spinner that overwrites the line with \r (e.g.
      // "⠋\r⠙\r⠹\rReading additional input from stdin..."). Taking the last
      // segment after \r simulates what the terminal renders and ensures banner
      // detection regexes match correctly.
      const stripped = raw.replace(ANSI_RE, '');
      const line = (stripped.includes('\r') ? stripped.split('\r').pop()! : stripped).trim();
      if (line.length === 0) continue;

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
