import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ensureNexusInGitignore, removeNexusFromGitignore } from '../NexusGitignoreManager';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-gitignore-test-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('ensureNexusInGitignore', () => {
  it('creates .gitignore with the .nexus/ entry when none exists', () => {
    const modified = ensureNexusInGitignore(tmp);
    expect(modified).toBe(true);

    const content = fs.readFileSync(path.join(tmp, '.gitignore'), 'utf8');
    expect(content).toContain('# Added by Nexus AI Code');
    expect(content).toContain('.nexus/');
  });

  it('appends the entry to an existing .gitignore without disturbing prior content', () => {
    fs.writeFileSync(path.join(tmp, '.gitignore'), 'node_modules/\ndist/\n', 'utf8');

    const modified = ensureNexusInGitignore(tmp);
    expect(modified).toBe(true);

    const content = fs.readFileSync(path.join(tmp, '.gitignore'), 'utf8');
    expect(content).toContain('node_modules/');
    expect(content).toContain('dist/');
    expect(content).toContain('.nexus/');
  });

  it('is idempotent — a second call makes no further changes', () => {
    ensureNexusInGitignore(tmp);
    const contentAfterFirst = fs.readFileSync(path.join(tmp, '.gitignore'), 'utf8');

    const modifiedSecondTime = ensureNexusInGitignore(tmp);
    expect(modifiedSecondTime).toBe(false);

    const contentAfterSecond = fs.readFileSync(path.join(tmp, '.gitignore'), 'utf8');
    expect(contentAfterSecond).toBe(contentAfterFirst);
  });

  it('does not duplicate the entry when .nexus is already present in some form', () => {
    fs.writeFileSync(path.join(tmp, '.gitignore'), '.nexus/\n', 'utf8');
    const modified = ensureNexusInGitignore(tmp);
    expect(modified).toBe(false);
  });
});

describe('removeNexusFromGitignore', () => {
  it('removes the marker + entry that ensureNexusInGitignore added', () => {
    ensureNexusInGitignore(tmp);
    const modified = removeNexusFromGitignore(tmp);
    expect(modified).toBe(true);

    const content = fs.readFileSync(path.join(tmp, '.gitignore'), 'utf8');
    expect(content).not.toContain('.nexus/');
    expect(content).not.toContain('# Added by Nexus AI Code');
  });

  it('returns false when there is nothing to remove', () => {
    expect(removeNexusFromGitignore(tmp)).toBe(false);
  });
});
