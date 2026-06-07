import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parsePromptAttachmentRefs, buildPromptAttachmentContext } from '../promptAttachments';

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
