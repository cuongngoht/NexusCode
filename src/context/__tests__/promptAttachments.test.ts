import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  parsePromptAttachmentRefs,
  buildPromptAttachmentContext,
  collectImageAttachmentPaths,
  listWorkspaceFiles,
  MAX_IMAGE_ATTACHMENTS,
} from '../promptAttachments';

// ── parsePromptAttachmentRefs ──────────────────────────────────────────────

describe('parsePromptAttachmentRefs', () => {
  it('parses a single file ref', () => {
    const refs = parsePromptAttachmentRefs('Please check @src/App.tsx for issues');
    expect(refs).toHaveLength(1);
    expect(refs[0].path).toBe('src/App.tsx');
    expect(refs[0].type).toBe('file');
  });

  it('parses multiple refs', () => {
    const refs = parsePromptAttachmentRefs('Look at @src/App.tsx and @src/index.ts');
    expect(refs.map(r => r.path)).toEqual(['src/App.tsx', 'src/index.ts']);
  });

  it('ignores email-like patterns', () => {
    const refs = parsePromptAttachmentRefs('Contact user@example.com for details');
    expect(refs).toHaveLength(0);
  });

  it('parses quoted paths', () => {
    const refs = parsePromptAttachmentRefs('See @"src/folder with spaces/file.ts"');
    expect(refs).toHaveLength(1);
    expect(refs[0].path).toBe('src/folder with spaces/file.ts');
  });

  it('deduplicates refs', () => {
    const refs = parsePromptAttachmentRefs('@src/App.tsx and @src/App.tsx again');
    expect(refs).toHaveLength(1);
  });

  it('parses root-level file refs', () => {
    const refs = parsePromptAttachmentRefs('update @package.json');
    expect(refs[0].path).toBe('package.json');
  });
});

// ── buildPromptAttachmentContext — path safety ─────────────────────────────

describe('buildPromptAttachmentContext – path safety', () => {
  it('rejects path traversal', () => {
    const ctx = buildPromptAttachmentContext('/workspace', '', [{ type: 'file', path: '../secret.txt' }]);
    expect(ctx).toContain('path traversal is not allowed');
    expect(ctx).not.toContain('## ../secret.txt');
  });

  it('rejects absolute paths', () => {
    const ctx = buildPromptAttachmentContext('/workspace', '', [{ type: 'file', path: '/etc/passwd' }]);
    expect(ctx).toContain('absolute paths are not allowed');
  });

  it('returns empty string for empty attachments and no refs', () => {
    const ctx = buildPromptAttachmentContext('/workspace', 'plain prompt with no refs', []);
    expect(ctx).toBe('');
  });
});

// ── buildPromptAttachmentContext — deduplication ───────────────────────────

describe('buildPromptAttachmentContext – deduplication', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-test-'));
    fs.writeFileSync(path.join(tmp, 'app.ts'), 'export const x = 1;');
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('includes file only once when both UI and @ref reference it', () => {
    const ctx = buildPromptAttachmentContext(
      tmp,
      'Check @app.ts please',
      [{ type: 'file', path: 'app.ts' }],
    );
    const occurrences = (ctx.match(/## app\.ts/g) ?? []).length;
    expect(occurrences).toBe(1);
  });
});

// ── buildPromptAttachmentContext — folder scan ─────────────────────────────

describe('buildPromptAttachmentContext – folder scan', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-test-'));
    fs.mkdirSync(path.join(tmp, 'src'));
    fs.writeFileSync(path.join(tmp, 'src', 'index.ts'), 'export default {}');
    fs.mkdirSync(path.join(tmp, 'node_modules', 'pkg'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'node_modules', 'pkg', 'index.js'), 'module.exports={}');
    fs.mkdirSync(path.join(tmp, '.git'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.git', 'config'), '[core]');
    fs.mkdirSync(path.join(tmp, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'dist', 'bundle.js'), 'bundled');
    fs.mkdirSync(path.join(tmp, '.nexus', 'runs'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.nexus', 'runs', 'plan.md'), '# Plan');
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('includes src files', () => {
    const ctx = buildPromptAttachmentContext(tmp, '', [{ type: 'folder', path: 'src' }]);
    expect(ctx).toContain('src/index.ts');
  });

  it('skips node_modules', () => {
    const ctx = buildPromptAttachmentContext(tmp, '', [{ type: 'folder', path: '.' }]);
    expect(ctx).not.toContain('node_modules');
  });

  it('skips .git', () => {
    const ctx = buildPromptAttachmentContext(tmp, '', [{ type: 'folder', path: '.' }]);
    expect(ctx).not.toContain('.git');
  });

  it('skips dist', () => {
    const ctx = buildPromptAttachmentContext(tmp, '', [{ type: 'folder', path: '.' }]);
    expect(ctx).not.toContain('dist/bundle.js');
  });

  it('skips .nexus/runs', () => {
    const ctx = buildPromptAttachmentContext(tmp, '', [{ type: 'folder', path: '.' }]);
    expect(ctx).not.toContain('runs/plan.md');
  });
});

// ── buildPromptAttachmentContext — secret file skipping ───────────────────

describe('buildPromptAttachmentContext – secret skipping', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-test-'));
    fs.writeFileSync(path.join(tmp, '.env'), 'SECRET=abc');
    fs.writeFileSync(path.join(tmp, '.env.production'), 'DB_PASS=xyz');
    fs.writeFileSync(path.join(tmp, 'server.pem'), '-----BEGIN CERTIFICATE-----');
    fs.writeFileSync(path.join(tmp, 'id_rsa'), '-----BEGIN RSA PRIVATE KEY-----');
    fs.writeFileSync(path.join(tmp, 'app.key'), 'private key data');
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('skips .env', () => {
    const ctx = buildPromptAttachmentContext(tmp, '', [{ type: 'file', path: '.env' }]);
    expect(ctx).toContain('secret file');
    expect(ctx).not.toContain('SECRET=abc');
  });

  it('skips .env.production', () => {
    const ctx = buildPromptAttachmentContext(tmp, '', [{ type: 'file', path: '.env.production' }]);
    expect(ctx).toContain('secret file');
  });

  it('skips .pem', () => {
    const ctx = buildPromptAttachmentContext(tmp, '', [{ type: 'file', path: 'server.pem' }]);
    expect(ctx).toContain('secret file');
  });

  it('skips id_rsa', () => {
    const ctx = buildPromptAttachmentContext(tmp, '', [{ type: 'file', path: 'id_rsa' }]);
    expect(ctx).toContain('secret file');
  });

  it('skips .key', () => {
    const ctx = buildPromptAttachmentContext(tmp, '', [{ type: 'file', path: 'app.key' }]);
    expect(ctx).toContain('secret file');
  });
});

// ── image attachments ──────────────────────────────────────────────────────

describe('image attachments', () => {
  let itmp: string;

  beforeEach(() => {
    itmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-img-att-'));
    fs.mkdirSync(path.join(itmp, 'docs'), { recursive: true });
    // 8-byte PNG signature — enough to be a real binary file on disk.
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    fs.writeFileSync(path.join(itmp, 'shot.png'), pngBytes);
    fs.writeFileSync(path.join(itmp, 'docs', 'mock.png'), pngBytes);
    fs.writeFileSync(path.join(itmp, 'notes.md'), '# hi\n', 'utf8');
  });

  afterEach(() => {
    fs.rmSync(itmp, { recursive: true, force: true });
  });

  it('does not emit a binary-file comment for an attached image', () => {
    const ctx = buildPromptAttachmentContext(itmp, '', [{ type: 'image', path: 'shot.png' }]);
    expect(ctx).not.toContain('binary file');
  });

  it('does not emit a fenced content block for an attached image', () => {
    const ctx = buildPromptAttachmentContext(itmp, '', [{ type: 'image', path: 'shot.png' }]);
    expect(ctx).not.toContain('## shot.png');
  });

  it('still emits text attachments alongside an image', () => {
    const ctx = buildPromptAttachmentContext(itmp, '', [
      { type: 'image', path: 'shot.png' },
      { type: 'file', path: 'notes.md' },
    ]);
    expect(ctx).toContain('## notes.md');
    expect(ctx).not.toContain('## shot.png');
  });

  it('collects an explicitly attached image', () => {
    const paths = collectImageAttachmentPaths(itmp, '', [{ type: 'image', path: 'shot.png' }]);
    expect(paths).toEqual(['shot.png']);
  });

  it('collects images classified as type file (e.g. dragged in)', () => {
    const paths = collectImageAttachmentPaths(itmp, '', [{ type: 'file', path: 'shot.png' }]);
    expect(paths).toEqual(['shot.png']);
  });

  it('collects an image from an @ref in the prompt', () => {
    const paths = collectImageAttachmentPaths(itmp, 'look at @docs/mock.png please', []);
    expect(paths).toEqual(['docs/mock.png']);
  });

  it('ignores non-image attachments', () => {
    const paths = collectImageAttachmentPaths(itmp, '', [{ type: 'file', path: 'notes.md' }]);
    expect(paths).toEqual([]);
  });

  it('rejects path traversal', () => {
    const paths = collectImageAttachmentPaths(itmp, '', [{ type: 'image', path: '../x.png' }]);
    expect(paths).toEqual([]);
  });

  it('rejects absolute paths', () => {
    const paths = collectImageAttachmentPaths(itmp, '', [{ type: 'image', path: '/etc/x.png' }]);
    expect(paths).toEqual([]);
  });

  it('skips images that do not exist', () => {
    const paths = collectImageAttachmentPaths(itmp, '', [{ type: 'image', path: 'gone.png' }]);
    expect(paths).toEqual([]);
  });

  it('deduplicates repeated paths', () => {
    const paths = collectImageAttachmentPaths(itmp, 'see @shot.png', [
      { type: 'image', path: 'shot.png' },
    ]);
    expect(paths).toEqual(['shot.png']);
  });

  it('caps the number of images', () => {
    const attachments = [];
    for (let i = 0; i < MAX_IMAGE_ATTACHMENTS + 4; i++) {
      const name = `img-${i}.png`;
      fs.writeFileSync(path.join(itmp, name), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      attachments.push({ type: 'image' as const, path: name });
    }
    const paths = collectImageAttachmentPaths(itmp, '', attachments);
    expect(paths).toHaveLength(MAX_IMAGE_ATTACHMENTS);
  });
});

describe('listWorkspaceFiles — pasted images', () => {
  let ltmp: string;

  beforeEach(() => {
    ltmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-lwf-'));
    fs.mkdirSync(path.join(ltmp, '.nexus', 'attachments'), { recursive: true });
    fs.mkdirSync(path.join(ltmp, '.nexus', 'plans'), { recursive: true });
    fs.writeFileSync(path.join(ltmp, '.nexus', 'attachments', 'pasted-1-0.png'), 'x');
    fs.writeFileSync(path.join(ltmp, '.nexus', 'plans', 'plan.md'), 'x');
    fs.writeFileSync(path.join(ltmp, 'app.ts'), 'x');
  });

  afterEach(() => {
    fs.rmSync(ltmp, { recursive: true, force: true });
  });

  it('excludes pasted screenshots from the picker list', () => {
    const files = listWorkspaceFiles(ltmp);
    expect(files.some(f => f.includes('.nexus/attachments'))).toBe(false);
  });

  it('still lists .nexus/plans and normal workspace files', () => {
    const files = listWorkspaceFiles(ltmp);
    expect(files).toContain('.nexus/plans/plan.md');
    expect(files).toContain('app.ts');
  });
});
