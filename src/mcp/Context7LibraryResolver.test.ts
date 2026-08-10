import { describe, it, expect } from 'vitest';
import { guessLibraryName, parseContext7LibraryId } from './Context7LibraryResolver';

// Captured verbatim from `resolve-library-id` on @upstash/context7-mcp v3.2.5.
const REAL_RESPONSE = `Available Libraries:

- Title: React
- Context7-compatible library ID: /reactjs/react.dev
- Description: React.dev is the official documentation website for React, a JavaScript library for building user interfaces, providing guides, API references, and tutorials.
- Code Snippets: 6052

- Title: React Native
- Context7-compatible library ID: /facebook/react-native-website
- Description: Docs for React Native.
- Code Snippets: 2100`;

describe('parseContext7LibraryId', () => {
  it('extracts the first (best-match) library id from a real response', () => {
    expect(parseContext7LibraryId(REAL_RESPONSE)).toBe('/reactjs/react.dev');
  });

  it('returns undefined when no library matched', () => {
    expect(parseContext7LibraryId('Available Libraries:\n\nNo results found.')).toBeUndefined();
    expect(parseContext7LibraryId('')).toBeUndefined();
  });

  it('is tolerant of casing and extra whitespace', () => {
    expect(parseContext7LibraryId('- context7-compatible library id:    /vercel/next.js')).toBe('/vercel/next.js');
  });
});

describe('guessLibraryName', () => {
  it('picks the first meaningful token, skipping stop-words', () => {
    expect(guessLibraryName('how to use react hooks')).toBe('react');
    expect(guessLibraryName('the vitest api documentation')).toBe('vitest');
  });

  it('keeps scoped package names intact', () => {
    expect(guessLibraryName('@upstash/context7-mcp usage')).toBe('@upstash/context7-mcp');
  });

  it('falls back to the whole query when every token is a stop-word', () => {
    expect(guessLibraryName('how to use')).toBe('how to use');
  });

  it('ignores single-character noise', () => {
    expect(guessLibraryName('a b zod schema')).toBe('zod');
  });
});
