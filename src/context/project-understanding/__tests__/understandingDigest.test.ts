import { describe, it, expect } from 'vitest';
import {
  buildUnderstandingDigest,
  buildUnderstandingNextSteps,
} from '../ProjectUnderstandingDigest';

const MAP = `# Project Understanding — nexus

_abc1234 · main · generated 2026-07-31_

## What this project is

A VS Code extension that routes prompts to installed CLI coding agents.

## Stack

| Aspect | Detail |
|---|---|
| Languages | TypeScript |

## Layers

### Core
Responsibility: domain types.

## Gotchas

- vi.json is the TypeScript type master, so a key missing from en.json is a compile error.
- compile:extension uses esbuild and does not typecheck.
- The scan-project branch of createPreSteps is unreachable.

## What I did not cover

The media/ directory.
`;

describe('buildUnderstandingDigest', () => {
  it('carries the headline sections into the journal', () => {
    const digest = buildUnderstandingDigest(MAP)!;
    expect(digest).toContain('What this project is:');
    expect(digest).toContain('routes prompts to installed CLI coding agents');
    expect(digest).toContain('Stack:');
    expect(digest).toContain('Gotchas:');
  });

  it('leaves the bulky sections on disk', () => {
    const digest = buildUnderstandingDigest(MAP)!;
    // Layers and coverage notes belong in the full map, not in every KB search hit.
    expect(digest).not.toContain('Responsibility: domain types');
    expect(digest).not.toContain('What I did not cover');
  });

  it('caps length so one entry cannot dominate BM25 retrieval', () => {
    const huge = '## What this project is\n\n' + 'x'.repeat(5000);
    const digest = buildUnderstandingDigest(huge, 300)!;
    expect(digest.length).toBeLessThanOrEqual(301);
    expect(digest.endsWith('…')).toBe(true);
  });

  it('falls back to the document body when the model used other headings', () => {
    const odd = '# Some Map\n\n## Overview\n\nIt is a compiler toolchain.';
    expect(buildUnderstandingDigest(odd)).toContain('It is a compiler toolchain.');
  });

  it('returns undefined for an empty map so the field is omitted, not blank', () => {
    expect(buildUnderstandingDigest('')).toBeUndefined();
    expect(buildUnderstandingDigest('# Title only\n\n')).toBeUndefined();
  });
});

describe('buildUnderstandingNextSteps', () => {
  it('lifts the gotcha bullets out as discrete items', () => {
    const steps = buildUnderstandingNextSteps(MAP)!;
    expect(steps).toHaveLength(3);
    expect(steps[0]).toBe(
      'vi.json is the TypeScript type master, so a key missing from en.json is a compile error.',
    );
    expect(steps[0].startsWith('-')).toBe(false);
  });

  it('caps the number of items', () => {
    const many = '## Gotchas\n\n' + Array.from({ length: 20 }, (_, i) => `- item ${i}`).join('\n');
    expect(buildUnderstandingNextSteps(many)).toHaveLength(5);
  });

  it('returns undefined when there is no gotchas or risks section', () => {
    expect(buildUnderstandingNextSteps('## Stack\n\nTypeScript.')).toBeUndefined();
  });
});
