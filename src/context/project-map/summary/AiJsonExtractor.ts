export class AiJsonExtractor {
  extract(raw: string): unknown {
    const cleaned = raw
      .replace(/^```json\s*/im, '')
      .replace(/^```\s*/im, '')
      .replace(/```\s*$/im, '')
      .trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) {
      throw new Error('No JSON object found in AI output');
    }
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}
