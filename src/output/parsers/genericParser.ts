export interface ParsedLine {
  kind: 'info' | 'error' | 'success' | 'raw';
  text: string;
}

export function parseGeneric(chunk: string): ParsedLine[] {
  return chunk
    .split('\n')
    .filter(l => l.trim() !== '')
    .map(text => ({
      kind: classifyLine(text),
      text,
    }));
}

function classifyLine(line: string): ParsedLine['kind'] {
  const lower = line.toLowerCase();
  if (lower.includes('error') || lower.includes('failed') || lower.includes('fatal')) {
    return 'error';
  }
  if (lower.includes('success') || lower.includes('done') || lower.includes('complete')) {
    return 'success';
  }
  return 'info';
}
