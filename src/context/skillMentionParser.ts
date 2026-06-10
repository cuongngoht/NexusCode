export interface SkillMentionParseResult {
  skillIds: string[];
  cleanedPrompt: string;
}

const MENTION_RE = /(?<![^\s(#])#([a-zA-Z0-9_-]+)(?![.\w])/g;

export function parseSkillMentions(
  prompt: string,
  knownSkillIds: string[],
): SkillMentionParseResult {
  const knownSet = new Set(knownSkillIds);
  const skillIds: string[] = [];
  const seen = new Set<string>();
  const tokenRanges: Array<{ start: number; end: number }> = [];

  let match: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((match = MENTION_RE.exec(prompt)) !== null) {
    const id = match[1];
    if (!knownSet.has(id)) continue;
    if (!seen.has(id)) {
      seen.add(id);
      skillIds.push(id);
    }
    tokenRanges.push({ start: match.index, end: match.index + match[0].length });
  }

  // Remove matched tokens from the prompt (process in reverse to preserve indices)
  let cleaned = prompt;
  for (let i = tokenRanges.length - 1; i >= 0; i--) {
    const { start, end } = tokenRanges[i];
    cleaned = cleaned.slice(0, start) + cleaned.slice(end);
  }

  return { skillIds, cleanedPrompt: cleaned.trim() };
}
