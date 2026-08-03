import * as fs from 'fs';
import * as path from 'path';

/**
 * Writes clipboard-pasted image bytes into `.nexus/attachments/` so the workspace-relative
 * path can be handed to a text CLI agent.
 *
 * Deliberately uses `fs` rather than `vscode.workspace.fs` so this module stays free of the
 * VS Code API and unit-testable — the same tradeoff `src/context/promptAttachments.ts` makes.
 */

export interface PastedImageInput {
  mimeType: string;
  base64: string;
}

export interface SavedPastedImage {
  /** POSIX, workspace-relative — satisfies `isSafePath` in promptAttachments.ts. */
  relPath: string;
}

export interface SavePastedImagesResult {
  saved: SavedPastedImage[];
  errors: string[];
}

/**
 * A 5 MB image becomes a ~6.7 MB JSON string over the webview IPC, which briefly blocks the
 * extension host during parse. Retina screenshots are typically 1-4 MB, so this covers the
 * real case with margin.
 */
export const MAX_PASTED_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PASTED_IMAGES_PER_PASTE = 5;
export const MAX_PASTED_TOTAL_BYTES = 12 * 1024 * 1024;

export const ATTACHMENTS_DIR = path.posix.join('.nexus', 'attachments');

/** SVG is intentionally absent — it is markup, and pasting gains nothing from accepting it. */
const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Cheap defence against a clipboard that lies about its `mimeType`. */
function matchesMagicBytes(buf: Buffer, ext: string): boolean {
  switch (ext) {
    case 'png':
      return buf.length >= 8 && buf.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
    case 'jpg':
      return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case 'gif':
      return buf.length >= 6 && buf.subarray(0, 4).toString('latin1') === 'GIF8';
    case 'webp':
      return buf.length >= 12
        && buf.subarray(0, 4).toString('latin1') === 'RIFF'
        && buf.subarray(8, 12).toString('latin1') === 'WEBP';
    default:
      return false;
  }
}

/** Decoded byte length without allocating the buffer. */
function approxDecodedBytes(base64: string): number {
  const clean = base64.replace(/=+$/, '');
  return Math.floor((clean.length * 3) / 4);
}

/**
 * `.nexus` is normally added to the workspace `.gitignore`, but that is gated on the
 * `nexus.projectMap.addToGitignore` setting. A self-ignoring directory guarantees pasted
 * screenshots never show up in `git status`, without touching the user's root `.gitignore`.
 */
function ensureSelfIgnored(absDir: string): void {
  const gitignorePath = path.join(absDir, '.gitignore');
  if (fs.existsSync(gitignorePath)) return;
  try {
    fs.writeFileSync(gitignorePath, '*\n', 'utf8');
  } catch {
    // Non-fatal: the image itself still saved.
  }
}

/** `pasted-<ms>-<i>.<ext>`, bumped until free — `Date.now()` alone collides within one paste. */
function reserveFilename(absDir: string, stamp: number, index: number, ext: string): string {
  const base = `pasted-${stamp}-${index}`;
  let name = `${base}.${ext}`;
  let bump = 0;
  while (fs.existsSync(path.join(absDir, name))) {
    bump++;
    name = `${base}-${bump}.${ext}`;
  }
  return name;
}

export function savePastedImages(
  workspaceRoot: string,
  images: PastedImageInput[],
): SavePastedImagesResult {
  const saved: SavedPastedImage[] = [];
  const errors: string[] = [];

  if (images.length === 0) return { saved, errors };

  let accepted = images;
  if (images.length > MAX_PASTED_IMAGES_PER_PASTE) {
    accepted = images.slice(0, MAX_PASTED_IMAGES_PER_PASTE);
    errors.push(
      `Only the first ${MAX_PASTED_IMAGES_PER_PASTE} of ${images.length} images were saved.`,
    );
  }

  const absDir = path.join(workspaceRoot, '.nexus', 'attachments');
  let dirReady = false;
  const stamp = Date.now();
  let totalBytes = 0;

  for (let i = 0; i < accepted.length; i++) {
    const img = accepted[i];
    const ext = EXT_BY_MIME[img.mimeType.toLowerCase()];
    if (!ext) {
      errors.push(`Unsupported image type: ${img.mimeType}`);
      continue;
    }

    // Reject on the cheap estimate before allocating a multi-MB buffer.
    if (approxDecodedBytes(img.base64) > MAX_PASTED_IMAGE_BYTES) {
      errors.push(
        `Image is too large (over ${formatBytes(MAX_PASTED_IMAGE_BYTES)}) and was not saved.`,
      );
      continue;
    }

    let buf: Buffer;
    try {
      buf = Buffer.from(img.base64, 'base64');
    } catch {
      errors.push('An image could not be decoded and was not saved.');
      continue;
    }

    if (buf.length === 0) {
      errors.push('An image was empty and was not saved.');
      continue;
    }
    if (buf.length > MAX_PASTED_IMAGE_BYTES) {
      errors.push(
        `Image is too large (${formatBytes(buf.length)}, limit ` +
        `${formatBytes(MAX_PASTED_IMAGE_BYTES)}) and was not saved.`,
      );
      continue;
    }
    if (totalBytes + buf.length > MAX_PASTED_TOTAL_BYTES) {
      errors.push(
        `Total pasted image size would exceed ${formatBytes(MAX_PASTED_TOTAL_BYTES)}; ` +
        'remaining images were not saved.',
      );
      break;
    }
    if (!matchesMagicBytes(buf, ext)) {
      errors.push(`An image did not look like a valid ${ext.toUpperCase()} file and was not saved.`);
      continue;
    }

    if (!dirReady) {
      try {
        fs.mkdirSync(absDir, { recursive: true });
        ensureSelfIgnored(absDir);
        dirReady = true;
      } catch (err) {
        errors.push(`Could not create ${ATTACHMENTS_DIR}: ${(err as Error).message}`);
        return { saved, errors };
      }
    }

    const name = reserveFilename(absDir, stamp, i, ext);
    try {
      fs.writeFileSync(path.join(absDir, name), buf);
    } catch (err) {
      errors.push(`Could not write ${name}: ${(err as Error).message}`);
      continue;
    }

    totalBytes += buf.length;
    saved.push({ relPath: path.posix.join(ATTACHMENTS_DIR, name) });
  }

  return { saved, errors };
}
