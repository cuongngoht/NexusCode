const RESEARCH_TOKEN_RE = /(?<![^\s(@])@research(?![.\w])/g;

const CONTINUE_SIGNALS = new Set([
  '',
  'tiếp tục',
  'tiep tuc',
  'continue',
  'next',
  'cont',
]);

export interface ResearchDetectionResult {
  found: boolean;
  isNew: boolean;
  problem: string;
  cleanedPrompt: string;
}

export function detectResearchMention(prompt: string): ResearchDetectionResult {
  RESEARCH_TOKEN_RE.lastIndex = 0;
  const match = RESEARCH_TOKEN_RE.exec(prompt);

  if (!match) {
    return { found: false, isNew: false, problem: '', cleanedPrompt: prompt };
  }

  const cleaned = (prompt.slice(0, match.index) + prompt.slice(match.index + match[0].length)).trim();
  const remainder = cleaned.toLowerCase().trim();
  const isNew = !CONTINUE_SIGNALS.has(remainder);

  const taskPrompt = isNew
    ? cleaned
    : 'Continue with the current research step as defined above.';

  return {
    found: true,
    isNew,
    problem: cleaned,
    cleanedPrompt: taskPrompt,
  };
}
