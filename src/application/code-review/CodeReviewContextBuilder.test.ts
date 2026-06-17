import { describe, it, expect } from 'vitest';
import { CodeReviewContextBuilder } from './CodeReviewContextBuilder';
import type { CodeReviewTarget } from './CodeReviewTarget';

/**
 * CodeReviewContextBuilder tests run in unit mode without real git.
 * We test the defensive behavior and target type routing only.
 */
describe('CodeReviewContextBuilder', () => {
  const builder = new CodeReviewContextBuilder();

  it('selection target returns diff from selectedText without git calls', () => {
    const target: CodeReviewTarget = {
      type: 'selection',
      selectedText: 'const foo = () => {}',
      filePath: 'src/foo.ts',
    };
    // Non-git workspace — builder should not throw
    const ctx = builder.build('/tmp', target);
    expect(ctx.target.type).toBe('selection');
    expect(ctx.diff).toBe('const foo = () => {}');
    expect(ctx.diffTruncated).toBe(false);
    expect(ctx.changedFiles).toHaveLength(0);
  });

  it('selection target with no selectedText returns empty diff', () => {
    const target: CodeReviewTarget = { type: 'selection' };
    const ctx = builder.build('/tmp', target);
    expect(ctx.diff).toBe('');
  });

  it('does not throw for non-git directory', () => {
    const target: CodeReviewTarget = { type: 'working-tree' };
    // Should not throw — git failure is handled gracefully
    expect(() => builder.build('/tmp', target)).not.toThrow();
  });

  it('returns diffTruncated false for empty diff', () => {
    const target: CodeReviewTarget = { type: 'selection', selectedText: 'x' };
    const ctx = builder.build('/tmp', target);
    expect(ctx.diffTruncated).toBe(false);
  });

  it('config maxDiffChars is accepted without error', () => {
    const target: CodeReviewTarget = { type: 'selection', selectedText: 'y' };
    expect(() => builder.build('/tmp', target, { maxDiffChars: 1000 })).not.toThrow();
  });
});
