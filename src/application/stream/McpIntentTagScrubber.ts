import { NEXUS_TOOL_INTENT_TAG } from '../../core/mcp/McpIntentProtocol';

const OPEN_TAG = `<${NEXUS_TOOL_INTENT_TAG}>`;
const CLOSE_TAG = `</${NEXUS_TOOL_INTENT_TAG}>`;

/**
 * Hard cap on how much text is withheld while waiting for a closing tag. Guards against
 * an agent that emits an opening tag and then streams a long answer without ever closing
 * it — the buffered text is released rather than lost.
 */
const MAX_HELD_CHARS = 8_000;

/**
 * Removes NEXUS_TOOL_INTENT blocks from text on its way to the chat transcript.
 *
 * The tag is Nexus-internal plumbing: the intent parser needs it, the user does not.
 * Stateful rather than a per-chunk `.replace()` because the block arrives split across
 * arbitrary stream chunks — `<NEXUS`, `_TOOL_INT`, `ENT>{...}</NEX`, … — so a stateless
 * filter would miss most real cases.
 *
 * One instance per run; not reusable across runs.
 */
export class McpIntentTagScrubber {
  /** Text withheld because it might be the start of an opening tag, or inside a block. */
  private held = '';
  private insideBlock = false;

  /** Feeds a chunk through, returning only the text safe to display. */
  push(chunk: string): string {
    this.held += chunk;
    let out = '';

    for (;;) {
      if (this.insideBlock) {
        const closeAt = this.held.indexOf(CLOSE_TAG);
        if (closeAt === -1) {
          // Still inside the block. Release nothing, but don't buffer without bound.
          if (this.held.length > MAX_HELD_CHARS) {
            out += this.held;
            this.held = '';
            this.insideBlock = false;
          }
          return out;
        }
        this.held = this.held.slice(closeAt + CLOSE_TAG.length);
        this.insideBlock = false;
        continue;
      }

      const openAt = this.held.indexOf(OPEN_TAG);
      if (openAt !== -1) {
        out += this.held.slice(0, openAt);
        this.held = this.held.slice(openAt + OPEN_TAG.length);
        this.insideBlock = true;
        continue;
      }

      // No complete opening tag. Keep back only a possible *partial* tag at the tail;
      // everything before it can never become one, so it is safe to emit now.
      const partial = partialTagSuffixLength(this.held, OPEN_TAG);
      out += this.held.slice(0, this.held.length - partial);
      this.held = this.held.slice(this.held.length - partial);
      return out;
    }
  }

  /**
   * Releases anything still held at end of stream.
   *
   * An unterminated block is emitted verbatim: showing a stray tag is a cosmetic
   * problem, silently swallowing the agent's answer is not.
   */
  flush(): string {
    const remaining = this.insideBlock ? `${OPEN_TAG}${this.held}` : this.held;
    this.held = '';
    this.insideBlock = false;
    return remaining;
  }
}

/** Length of the longest suffix of `text` that is a proper prefix of `tag`. */
function partialTagSuffixLength(text: string, tag: string): number {
  const max = Math.min(text.length, tag.length - 1);
  for (let len = max; len > 0; len--) {
    if (text.endsWith(tag.slice(0, len))) return len;
  }
  return 0;
}
