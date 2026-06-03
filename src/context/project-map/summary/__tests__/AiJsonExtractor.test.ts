import { describe, it, expect } from 'vitest';
import { AiJsonExtractor } from '../AiJsonExtractor';

const extractor = new AiJsonExtractor();

const validJson = { summary: 'test', risks: [], missingPieces: [], nextSteps: [] };

describe('AiJsonExtractor', () => {
  it('parses raw JSON directly', () => {
    const result = extractor.extract(JSON.stringify(validJson));
    expect(result).toEqual(validJson);
  });

  it('strips ```json code fence and parses', () => {
    const raw = '```json\n' + JSON.stringify(validJson) + '\n```';
    const result = extractor.extract(raw);
    expect(result).toEqual(validJson);
  });

  it('strips preamble text before JSON object', () => {
    const raw = 'Here is the analysis:\n\n' + JSON.stringify(validJson);
    const result = extractor.extract(raw);
    expect(result).toEqual(validJson);
  });

  it('throws when no JSON object is found', () => {
    expect(() => extractor.extract('This is just plain text.')).toThrow(
      'No JSON object found in AI output',
    );
  });
});
