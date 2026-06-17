export interface PromptReferenceCandidate {
  id: string;
  title?: string;
  description?: string;
}

export interface PromptReferenceMatch<T extends PromptReferenceCandidate> {
  candidate: T;
  score: number;
}

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

function segmentStartsWith(value: string, query: string): boolean {
  return value
    .split(/[-_\s/]+/)
    .some(segment => segment.startsWith(query));
}

function compact(value: string): string {
  return normalize(value).replace(/[-_\s/]+/g, '');
}

export function scorePromptReference(
  candidate: PromptReferenceCandidate,
  query: string,
): number | undefined {
  const q = normalize(query);
  if (!q) return 0;

  const id = normalize(candidate.id);
  const title = normalize(candidate.title ?? '');
  const description = normalize(candidate.description ?? '');
  const compactQuery = compact(q);

  if (id === q) return 0;
  if (id.startsWith(q)) return 10;
  if (segmentStartsWith(id, q)) return 20;
  if (title.startsWith(q)) return 30;
  if (compact(id).startsWith(compactQuery)) return 35;
  if (id.includes(q)) return 40;
  if (title.includes(q)) return 50;
  if (description.includes(q)) return 60;

  return undefined;
}

export function filterPromptReferenceCandidates<T extends PromptReferenceCandidate>(
  candidates: readonly T[],
  query: string,
  limit = 20,
): T[] {
  return candidates
    .map((candidate): PromptReferenceMatch<T> | undefined => {
      const score = scorePromptReference(candidate, query);
      return score === undefined ? undefined : { candidate, score };
    })
    .filter((match): match is PromptReferenceMatch<T> => match !== undefined)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.candidate.id.localeCompare(b.candidate.id);
    })
    .slice(0, limit)
    .map(match => match.candidate);
}
