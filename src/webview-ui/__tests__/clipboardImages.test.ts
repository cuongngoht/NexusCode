import { describe, it, expect } from 'vitest';
import {
  harvestClipboard,
  readImageAsBase64,
  MAX_PASTED_IMAGE_BYTES,
  type ClipboardLike,
  type DataTransferItemLike,
} from '../clipboardImages';

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function imageFile(name = 'image.png', size = 32, type = 'image/png'): File {
  return new File([new Uint8Array(size)], name, { type, lastModified: 1 });
}

/** Simulates the Electron-only `.path` property present on files copied in Finder. */
function pathedFile(name: string, fsPath: string, type = 'image/png'): File {
  const f = new File([new Uint8Array(8)], name, { type, lastModified: 2 });
  Object.defineProperty(f, 'path', { value: fsPath });
  return f;
}

function item(file: File | null, type = 'image/png', kind = 'file'): DataTransferItemLike {
  return { kind, type, getAsFile: () => file };
}

function clipboard(opts: Partial<ClipboardLike> = {}): ClipboardLike {
  return {
    files: opts.files ?? [],
    items: opts.items,
    types: opts.types ?? [],
    getData: opts.getData ?? (() => ''),
  };
}

describe('harvestClipboard', () => {
  it('returns nothing for an empty clipboard', () => {
    const r = harvestClipboard(clipboard());
    expect(r.paths).toEqual([]);
    expect(r.imageFiles).toEqual([]);
    expect(r.hasText).toBe(false);
    expect(r.oversized).toEqual([]);
  });

  it('routes an image blob with no fs path to imageFiles', () => {
    const f = imageFile();
    const r = harvestClipboard(clipboard({ files: [f] }));
    expect(r.imageFiles).toEqual([f]);
    expect(r.paths).toEqual([]);
  });

  it('routes a file with an fs path to paths', () => {
    const r = harvestClipboard(clipboard({ files: [pathedFile('a.png', '/abs/a.png')] }));
    expect(r.paths).toEqual(['/abs/a.png']);
    expect(r.imageFiles).toEqual([]);
  });

  it('harvests an image present in items but absent from files', () => {
    // Windows Snipping Tool / some Chromium builds populate only one of the two.
    const f = imageFile();
    const r = harvestClipboard(clipboard({ items: [item(f)], files: [] }));
    expect(r.imageFiles).toEqual([f]);
  });

  it('does not double-count an image present in both items and files', () => {
    const f = imageFile();
    const r = harvestClipboard(clipboard({ items: [item(f)], files: [f] }));
    expect(r.imageFiles).toHaveLength(1);
  });

  it('ignores non-image items', () => {
    const txt = new File(['hi'], 'a.txt', { type: 'text/plain', lastModified: 3 });
    const r = harvestClipboard(clipboard({ items: [item(txt, 'text/plain')], files: [txt] }));
    expect(r.imageFiles).toEqual([]);
    expect(r.paths).toEqual([]);
  });

  it('ignores a string-kind item', () => {
    const r = harvestClipboard(clipboard({ items: [item(null, 'text/plain', 'string')] }));
    expect(r.imageFiles).toEqual([]);
  });

  it('reports hasText when the clipboard also carries text', () => {
    const r = harvestClipboard(clipboard({
      files: [imageFile()],
      types: ['text/plain', 'Files'],
      getData: () => 'some pasted text',
    }));
    expect(r.hasText).toBe(true);
    expect(r.imageFiles).toHaveLength(1);
  });

  it('does not report hasText for an empty text/plain entry', () => {
    const r = harvestClipboard(clipboard({ types: ['text/plain'], getData: () => '' }));
    expect(r.hasText).toBe(false);
  });

  it('flags an oversized image and excludes it from imageFiles', () => {
    const big = imageFile('big.png', MAX_PASTED_IMAGE_BYTES + 1);
    const r = harvestClipboard(clipboard({ files: [big] }));
    expect(r.imageFiles).toEqual([]);
    expect(r.oversized).toEqual(['big.png']);
  });

  it('keeps a small image while flagging an oversized sibling', () => {
    const small = imageFile('small.png', 16);
    const big = imageFile('big.png', MAX_PASTED_IMAGE_BYTES + 1);
    const r = harvestClipboard(clipboard({ files: [small, big] }));
    expect(r.imageFiles).toEqual([small]);
    expect(r.oversized).toEqual(['big.png']);
  });

  it('survives a getData that throws', () => {
    const r = harvestClipboard(clipboard({
      types: ['text/plain'],
      getData: () => { throw new Error('nope'); },
    }));
    expect(r.hasText).toBe(false);
  });
});

describe('readImageAsBase64', () => {
  it('returns the mime type and bare base64 without the data URL prefix', async () => {
    const file = new File([new Uint8Array(PNG_SIG)], 'x.png', { type: 'image/png' });
    const { mimeType, base64 } = await readImageAsBase64(file);
    expect(mimeType).toBe('image/png');
    expect(base64).not.toContain('data:');
    expect(base64).not.toContain(',');
    // Round-trips back to the original bytes.
    expect(Array.from(Buffer.from(base64, 'base64'))).toEqual(PNG_SIG);
  });

  it('falls back to image/png when the file has no type', async () => {
    const file = new File([new Uint8Array(4)], 'x', { type: '' });
    const { mimeType } = await readImageAsBase64(file);
    expect(mimeType).toBe('image/png');
  });
});
