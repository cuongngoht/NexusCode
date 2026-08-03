import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { isImageAttachmentPath, buildImageAttachmentList } from '../imageAttachments';

describe('isImageAttachmentPath', () => {
  it('accepts common image extensions', () => {
    for (const p of ['a.png', 'b.jpg', 'c.jpeg', 'd.gif', 'e.webp', 'f.bmp', 'g.svg']) {
      expect(isImageAttachmentPath(p)).toBe(true);
    }
  });

  it('is case-insensitive', () => {
    expect(isImageAttachmentPath('shot.PNG')).toBe(true);
    expect(isImageAttachmentPath('Shot.JPeG')).toBe(true);
  });

  it('rejects non-image files', () => {
    expect(isImageAttachmentPath('src/App.tsx')).toBe(false);
    expect(isImageAttachmentPath('README.md')).toBe(false);
    expect(isImageAttachmentPath('noext')).toBe(false);
  });

  it('does not false-positive when the image ext is not last', () => {
    expect(isImageAttachmentPath('notanimage.png.txt')).toBe(false);
  });

  it('handles nested paths', () => {
    expect(isImageAttachmentPath('.nexus/attachments/pasted-1-0.png')).toBe(true);
  });
});

describe('buildImageAttachmentList', () => {
  const root = path.resolve('/tmp/proj');

  it('returns empty string for no paths', () => {
    expect(buildImageAttachmentList(root, [])).toBe('');
  });

  it('instructs the agent to read the file from disk', () => {
    const out = buildImageAttachmentList(root, ['a.png']);
    expect(out).toContain('image-capable file read tool');
    expect(out).toContain('do not guess');
  });

  it('reports the image count', () => {
    expect(buildImageAttachmentList(root, ['a.png', 'b.png'])).toContain('2 image(s)');
  });

  it('emits both the relative and absolute path forms', () => {
    const out = buildImageAttachmentList(root, ['.nexus/attachments/x.png']);
    expect(out).toContain('- .nexus/attachments/x.png');
    expect(out).toContain(`(absolute: ${path.resolve(root, '.nexus/attachments/x.png')})`);
  });

  it('lists every path', () => {
    const out = buildImageAttachmentList(root, ['a.png', 'sub/b.jpg']);
    expect(out).toContain('- a.png');
    expect(out).toContain('- sub/b.jpg');
  });
});
