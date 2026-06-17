export interface PromptSourceReferenceParseResult {
  agentIds: string[];
  skillIds: string[];
  commandIds: string[];
  cleanedPrompt: string;
}

interface MatchedRange {
  start: number;
  end: number;
}

export function parsePromptSourceReferences(input: string): PromptSourceReferenceParseResult {
  const agentIds: string[] = [];
  const skillIds: string[] = [];
  const commandIds: string[] = [];
  const seenAgents = new Set<string>();
  const seenSkills = new Set<string>();
  const seenCommands = new Set<string>();
  const rangesToRemove: MatchedRange[] = [];

  // @agent — must be preceded by start-of-string or whitespace, NOT part of an email
  const agentRe = /(^|\s)@([a-zA-Z0-9_-]+)(?=\s|$)/g;
  let match: RegExpExecArray | null;

  while ((match = agentRe.exec(input)) !== null) {
    const prefix = match[1] ?? '';
    const id = match[2];
    const matchStart = match.index;

    // Email guard: only applies when the @token appears at the very start of the string
    // (prefix === ''). If a non-whitespace character immediately precedes position 0 it's
    // impossible, but if prefix is a space we already know whitespace precedes the @.
    if (prefix === '' && matchStart > 0) {
      // @ is at the start but there's something before it in the string — email pattern
      const charBefore = input[matchStart - 1] ?? '';
      if (/\S/.test(charBefore)) {
        continue;
      }
    }

    if (!seenAgents.has(id)) {
      seenAgents.add(id);
      agentIds.push(id);
    }
    // Remove the matched token (keep the leading whitespace prefix intact for spacing)
    const tokenStart = matchStart + prefix.length;
    const tokenEnd = match.index + match[0].length;
    rangesToRemove.push({ start: tokenStart, end: tokenEnd });
  }

  // #skill
  const skillRe = /(^|\s)#([a-zA-Z0-9_-]+)(?=\s|$)/g;
  while ((match = skillRe.exec(input)) !== null) {
    const prefix = match[1] ?? '';
    const id = match[2];
    if (!seenSkills.has(id)) {
      seenSkills.add(id);
      skillIds.push(id);
    }
    const tokenStart = match.index + prefix.length;
    const tokenEnd = match.index + match[0].length;
    rangesToRemove.push({ start: tokenStart, end: tokenEnd });
  }

  // /command
  const commandRe = /(^|\s)\/([a-zA-Z0-9_-]+)(?=\s|$)/g;
  while ((match = commandRe.exec(input)) !== null) {
    const prefix = match[1] ?? '';
    const id = match[2];
    if (!seenCommands.has(id)) {
      seenCommands.add(id);
      commandIds.push(id);
    }
    const tokenStart = match.index + prefix.length;
    const tokenEnd = match.index + match[0].length;
    rangesToRemove.push({ start: tokenStart, end: tokenEnd });
  }

  // Remove matched ranges from the input, working from end to start to preserve indices
  rangesToRemove.sort((a, b) => b.start - a.start);
  let cleaned = input;
  for (const range of rangesToRemove) {
    cleaned = cleaned.slice(0, range.start) + cleaned.slice(range.end);
  }
  const cleanedPrompt = cleaned.replace(/\s+/g, ' ').trim();

  return { agentIds, skillIds, commandIds, cleanedPrompt };
}
