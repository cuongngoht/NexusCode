import { describe, it, expect } from 'vitest';
import { GptTokenCounter } from './TokenCounter';

describe('GptTokenCounter', () => {
  const counter = new GptTokenCounter();

  it('empty string returns 0', () => {
    expect(counter.countText('')).toBe(0);
  });

  it('whitespace-only string returns 0', () => {
    expect(counter.countText('   ')).toBe(0);
  });

  it('normal text returns > 0', () => {
    expect(counter.countText('hello world')).toBeGreaterThan(0);
  });

  it('enhanced prompt token count can be greater than original prompt', () => {
    const original = 'Fix the bug';
    const enhanced = 'Fix the bug\n\n# Context\nThis is a large project with many files. Here is the relevant context: ...' +
      ' '.repeat(200) + 'Additional workspace context';
    const originalCount = counter.countText(original);
    const enhancedCount = counter.countText(enhanced);
    expect(enhancedCount).toBeGreaterThan(originalCount);
  });
});
