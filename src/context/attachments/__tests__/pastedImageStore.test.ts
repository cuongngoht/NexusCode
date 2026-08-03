import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  savePastedImages,
  MAX_PASTED_IMAGE_BYTES,
  MAX_PASTED_IMAGES_PER_PASTE,
} from '../pastedImageStore';

// Minimal byte headers — the store only validates the signature, not full image structure.
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPG_SIG = [0xff, 0xd8, 0xff];

function png(padBytes = 16): string {
  return Buffer.concat([Buffer.from(PNG_SIG), Buffer.alloc(padBytes, 1)]).toString('base64');
}
function jpg(): string {
  return Buffer.concat([Buffer.from(JPG_SIG), Buffer.alloc(16, 1)]).toString('base64');
}

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-pasted-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('savePastedImages', () => {
  it('returns nothing for an empty list', () => {
    const r = savePastedImages(tmp, []);
    expect(r.saved).toEqual([]);
    expect(r.errors).toEqual([]);
  });

  it('creates .nexus/attachments and writes the file', () => {
    const r = savePastedImages(tmp, [{ mimeType: 'image/png', base64: png() }]);
    expect(r.errors).toEqual([]);
    expect(r.saved).toHaveLength(1);

    const abs = path.join(tmp, r.saved[0].relPath);
    expect(fs.existsSync(abs)).toBe(true);
    expect(fs.readFileSync(abs).subarray(0, 8)).toEqual(Buffer.from(PNG_SIG));
  });

  it('returns a POSIX workspace-relative path under .nexus/attachments', () => {
    const r = savePastedImages(tmp, [{ mimeType: 'image/png', base64: png() }]);
    expect(r.saved[0].relPath.startsWith('.nexus/attachments/pasted-')).toBe(true);
    expect(r.saved[0].relPath).not.toContain('\\');
    expect(path.isAbsolute(r.saved[0].relPath)).toBe(false);
    expect(r.saved[0].relPath).not.toContain('..');
  });

  it('maps mime types to the right extension', () => {
    const r = savePastedImages(tmp, [
      { mimeType: 'image/png', base64: png() },
      { mimeType: 'image/jpeg', base64: jpg() },
    ]);
    expect(r.saved).toHaveLength(2);
    expect(r.saved[0].relPath.endsWith('.png')).toBe(true);
    expect(r.saved[1].relPath.endsWith('.jpg')).toBe(true);
  });

  it('gives two images in one call distinct names', () => {
    const r = savePastedImages(tmp, [
      { mimeType: 'image/png', base64: png() },
      { mimeType: 'image/png', base64: png(32) },
    ]);
    expect(r.saved).toHaveLength(2);
    expect(r.saved[0].relPath).not.toBe(r.saved[1].relPath);
  });

  it('bumps the filename instead of overwriting when the clock collides', () => {
    // Freeze time so both calls compute the same `pasted-<ms>-0` base name, which is the
    // only way to actually exercise the collision-bump loop.
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    try {
      const first = savePastedImages(tmp, [{ mimeType: 'image/png', base64: png() }]);
      const existing = path.join(tmp, first.saved[0].relPath);
      const originalSize = fs.statSync(existing).size;

      const second = savePastedImages(tmp, [{ mimeType: 'image/png', base64: png(64) }]);

      expect(second.saved).toHaveLength(1);
      expect(second.saved[0].relPath).not.toBe(first.saved[0].relPath);
      expect(second.saved[0].relPath).toContain('pasted-1700000000000-0-1.png');
      // The original file is untouched.
      expect(fs.statSync(existing).size).toBe(originalSize);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('writes a self-ignoring .gitignore into the attachments dir', () => {
    savePastedImages(tmp, [{ mimeType: 'image/png', base64: png() }]);
    const gi = path.join(tmp, '.nexus', 'attachments', '.gitignore');
    expect(fs.existsSync(gi)).toBe(true);
    expect(fs.readFileSync(gi, 'utf8')).toBe('*\n');
  });

  it('does not clobber an existing .gitignore', () => {
    const dir = path.join(tmp, '.nexus', 'attachments');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '.gitignore'), 'custom\n', 'utf8');
    savePastedImages(tmp, [{ mimeType: 'image/png', base64: png() }]);
    expect(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8')).toBe('custom\n');
  });

  it('rejects an unsupported mime type', () => {
    const r = savePastedImages(tmp, [{ mimeType: 'image/svg+xml', base64: png() }]);
    expect(r.saved).toEqual([]);
    expect(r.errors.join(' ')).toContain('Unsupported image type');
  });

  it('rejects bytes that do not match the claimed mime type', () => {
    // Claims PNG but carries JPEG bytes.
    const r = savePastedImages(tmp, [{ mimeType: 'image/png', base64: jpg() }]);
    expect(r.saved).toEqual([]);
    expect(r.errors.join(' ')).toContain('did not look like a valid PNG');
  });

  it('rejects an oversized image without writing it', () => {
    const big = Buffer.concat([
      Buffer.from(PNG_SIG),
      Buffer.alloc(MAX_PASTED_IMAGE_BYTES + 1024, 7),
    ]).toString('base64');
    const r = savePastedImages(tmp, [{ mimeType: 'image/png', base64: big }]);
    expect(r.saved).toEqual([]);
    expect(r.errors.join(' ')).toContain('too large');
    expect(fs.existsSync(path.join(tmp, '.nexus', 'attachments'))).toBe(false);
  });

  it('rejects an empty image', () => {
    const r = savePastedImages(tmp, [{ mimeType: 'image/png', base64: '' }]);
    expect(r.saved).toEqual([]);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('caps the number of images per paste', () => {
    const many = Array.from({ length: MAX_PASTED_IMAGES_PER_PASTE + 3 }, (_, i) => ({
      mimeType: 'image/png',
      base64: png(8 + i),
    }));
    const r = savePastedImages(tmp, many);
    expect(r.saved).toHaveLength(MAX_PASTED_IMAGES_PER_PASTE);
    expect(r.errors.join(' ')).toContain(`first ${MAX_PASTED_IMAGES_PER_PASTE}`);
  });

  it('keeps the good images when one in the batch is invalid', () => {
    const r = savePastedImages(tmp, [
      { mimeType: 'image/png', base64: png() },
      { mimeType: 'application/pdf', base64: png() },
      { mimeType: 'image/png', base64: png(24) },
    ]);
    expect(r.saved).toHaveLength(2);
    expect(r.errors).toHaveLength(1);
  });
});
