import { describe, it, expect } from 'vitest';
import { buildEnhancedPrompt, type PromptContext } from '../promptBuilder';

function baseCtx(overrides: Partial<PromptContext> = {}): PromptContext {
  return {
    workspace: { name: 'proj', root: '/tmp/proj' } as PromptContext['workspace'],
    packages: { manager: 'unknown', frameworks: [], scripts: [] } as PromptContext['packages'],
    rules: '',
    mode: 'ask',
    ...overrides,
  };
}

describe('buildEnhancedPrompt — # Attached Images', () => {
  it('omits the section when there are no image paths', () => {
    const out = buildEnhancedPrompt('hello', baseCtx());
    expect(out).not.toContain('# Attached Images');
  });

  it('omits the section for an empty array', () => {
    const out = buildEnhancedPrompt('hello', baseCtx({ imageAttachmentPaths: [] }));
    expect(out).not.toContain('# Attached Images');
  });

  it('emits the section when image paths are present', () => {
    const out = buildEnhancedPrompt('hello', baseCtx({
      imageAttachmentPaths: ['.nexus/attachments/pasted-1-0.png'],
    }));
    expect(out).toContain('# Attached Images');
    expect(out).toContain('.nexus/attachments/pasted-1-0.png');
  });

  it('includes the absolute path form so a CLI read tool can resolve it', () => {
    const out = buildEnhancedPrompt('hello', baseCtx({
      imageAttachmentPaths: ['shot.png'],
    }));
    expect(out).toContain('absolute:');
  });

  it('keeps # Attached Files and # Attached Images as separate sections', () => {
    const out = buildEnhancedPrompt('hello', baseCtx({
      attachmentContext: '## notes.md\n\n```md\nhi\n```',
      imageAttachmentPaths: ['shot.png'],
    }));
    expect(out).toContain('# Attached Files');
    expect(out).toContain('# Attached Images');
    expect(out.indexOf('# Attached Files')).toBeLessThan(out.indexOf('# Attached Images'));
  });

  it('still contains the user prompt', () => {
    const out = buildEnhancedPrompt('describe this screenshot', baseCtx({
      imageAttachmentPaths: ['shot.png'],
    }));
    expect(out).toContain('describe this screenshot');
  });
});
