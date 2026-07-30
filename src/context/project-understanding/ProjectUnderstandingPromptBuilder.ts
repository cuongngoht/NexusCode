import type { LoadedProjectUnderstanding } from './ProjectUnderstandingLoader';

export interface UnderstandingPromptOptions {
  /**
   * Hard cap on injected characters. This block rides along on *every* task, so
   * its cost is paid repeatedly — unlike a one-off scan. Matches the ceiling
   * the other context producers use (architecture RAG: 3000, file
   * intelligence: 9600 total).
   */
  maxChars?: number;
}

const DEFAULT_MAX_CHARS = 6000;

/**
 * Renders the persisted map into a prompt block.
 *
 * Truncation drops from the end rather than summarising, because the map's own
 * structure is front-loaded by design — "What this project is", "Layers", and
 * "Where to make common changes" come before "Gotchas" and "What I did not
 * cover". Cutting the tail therefore loses the least useful material, and the
 * marker tells the model the map continues on disk so it can read the rest when
 * it needs to.
 */
export class ProjectUnderstandingPromptBuilder {
  build(loaded: LoadedProjectUnderstanding, options: UnderstandingPromptOptions = {}): string {
    const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
    const lines: string[] = [];

    if (loaded.isStale) {
      lines.push(
        '<staleness_warning>',
        `This project map was generated ${loaded.ageDays} day(s) ago at commit ${loaded.manifest.commit} and has since been marked stale.`,
        'Trust its layer names, conventions and gotchas; re-verify exact file paths before relying on them.',
        'Suggest the user re-run understand mode if the structure looks materially different.',
        '</staleness_warning>',
        '',
      );
    } else {
      lines.push(`_Map generated at commit ${loaded.manifest.commit}, ${loaded.ageDays} day(s) ago._`, '');
    }

    let body = loaded.markdown;
    if (body.length > maxChars) {
      body =
        body.slice(0, maxChars).trimEnd() +
        `\n\n…(map truncated at ${maxChars} chars — full version at .nexus/project-understanding/understanding.md)`;
    }

    lines.push(body);
    return lines.join('\n');
  }
}
