import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { CodeReviewPromptBuilder } from './CodeReviewPromptBuilder';
import type { CodeReviewContext } from './CodeReviewContextBuilder';
import type { CodeReviewTarget } from './CodeReviewTarget';

const EXTENSION_ROOT = path.join(__dirname, '../../..');
const builder = new CodeReviewPromptBuilder(EXTENSION_ROOT);

function makeContext(overrides: Partial<CodeReviewContext> = {}): CodeReviewContext {
  const target: CodeReviewTarget = { type: 'branch', baseBranch: 'main' };
  return {
    target,
    baseBranch: 'main',
    compareBranch: 'feature/my-branch',
    currentBranch: 'feature/my-branch',
    changedFiles: [
      { path: 'src/foo.ts', status: 'M' },
      { path: 'src/bar.ts', status: 'A' },
    ],
    diffStat: '2 files changed, 42 insertions(+), 8 deletions(-)',
    diff: 'diff --git a/src/foo.ts b/src/foo.ts\n+some new code\n',
    diffTruncated: false,
    ...overrides,
  };
}

describe('CodeReviewPromptBuilder', () => {
  it('builds a prompt that includes role section', () => {
    const ctx = makeContext();
    const prompt = builder.build({ context: ctx });
    expect(prompt).toContain('Nexus Architecture Code Reviewer');
    expect(prompt).toContain('Architecture review is mandatory');
  });

  it('includes changed files section', () => {
    const ctx = makeContext();
    const prompt = builder.build({ context: ctx });
    expect(prompt).toContain('src/foo.ts');
    expect(prompt).toContain('src/bar.ts');
  });

  it('includes diff stat', () => {
    const ctx = makeContext();
    const prompt = builder.build({ context: ctx });
    expect(prompt).toContain('2 files changed');
  });

  it('includes git diff', () => {
    const ctx = makeContext();
    const prompt = builder.build({ context: ctx });
    expect(prompt).toContain('some new code');
  });

  it('shows truncation notice when diff is truncated', () => {
    const ctx = makeContext({ diffTruncated: true });
    const prompt = builder.build({ context: ctx });
    expect(prompt).toContain('truncated');
  });

  it('includes user request when provided', () => {
    const ctx = makeContext();
    const prompt = builder.build({ context: ctx, userPrompt: 'Focus on dependency direction.' });
    expect(prompt).toContain('Focus on dependency direction.');
  });

  it('includes output contract with JSON schema', () => {
    const ctx = makeContext();
    const prompt = builder.build({ context: ctx });
    expect(prompt).toContain('"verdict"');
    expect(prompt).toContain('"architectureScore"');
    expect(prompt).toContain('"findings"');
  });

  it('architecture preset mentions architecture focus', () => {
    const ctx = makeContext();
    const prompt = builder.build({ context: ctx, preset: 'architecture' });
    expect(prompt).toContain('architecture');
  });

  it('includes project rules when present', () => {
    const ctx = makeContext({
      projectRules: {
        architecturePolicy: 'UI must not call application layer directly.',
      },
    });
    const prompt = builder.build({ context: ctx });
    expect(prompt).toContain('UI must not call application layer directly.');
  });

  it('selection target shows selected code section', () => {
    const target: CodeReviewTarget = { type: 'selection', selectedText: 'const x = useReducer()' };
    const ctx: CodeReviewContext = {
      target,
      changedFiles: [],
      diff: 'const x = useReducer()',
      diffTruncated: false,
    };
    const prompt = builder.build({ context: ctx });
    expect(prompt).toContain('useReducer');
  });

  it('does not include design pattern recommendation section unless in prompt', () => {
    const ctx = makeContext();
    const prompt = builder.build({ context: ctx });
    // The prompt warns NOT to recommend patterns unless necessary
    expect(prompt).toContain('Do NOT recommend a design pattern unless');
  });

  it('includes project memory context when provided', () => {
    const ctx = makeContext();
    const prompt = builder.build({
      context: ctx,
      projectMemoryContext: '<project_memory>[1] Section: Architecture\nContent: uses Clean Architecture</project_memory>',
    });
    expect(prompt).toContain('## Project Context (Retrieved)');
    expect(prompt).toContain('uses Clean Architecture');
  });

  it('omits project context section when not provided', () => {
    const ctx = makeContext();
    const prompt = builder.build({ context: ctx });
    expect(prompt).not.toContain('## Project Context (Retrieved)');
  });

  it('includes architecture context when provided', () => {
    const ctx = makeContext();
    const prompt = builder.build({
      context: ctx,
      architectureContext: '## Architecture Context (clean architecture)\n[module] src/core/Foo.ts — layer: core',
    });
    expect(prompt).toContain('## Architecture Context (Retrieved)');
    expect(prompt).toContain('src/core/Foo.ts');
  });

  it('omits architecture context section when not provided', () => {
    const ctx = makeContext();
    const prompt = builder.build({ context: ctx });
    expect(prompt).not.toContain('## Architecture Context (Retrieved)');
  });

  it('includes knowledge base context when provided', () => {
    const ctx = makeContext();
    const prompt = builder.build({
      context: ctx,
      knowledgeBaseContext: 'Task journal: previously fixed a similar bug in src/foo.ts',
    });
    expect(prompt).toContain('## Project Knowledge Base (Retrieved)');
    expect(prompt).toContain('previously fixed a similar bug');
  });

  it('omits knowledge base context section when not provided', () => {
    const ctx = makeContext();
    const prompt = builder.build({ context: ctx });
    expect(prompt).not.toContain('## Project Knowledge Base (Retrieved)');
  });

  it('includes knowledge facts context when provided', () => {
    const ctx = makeContext();
    const prompt = builder.build({
      context: ctx,
      knowledgeFactsContext: '[invariant] IEventBus: emit is synchronous',
    });
    expect(prompt).toContain('## Knowledge Facts (Retrieved)');
    expect(prompt).toContain('emit is synchronous');
  });

  it('omits knowledge facts context section when not provided', () => {
    const ctx = makeContext();
    const prompt = builder.build({ context: ctx });
    expect(prompt).not.toContain('## Knowledge Facts (Retrieved)');
  });
});
