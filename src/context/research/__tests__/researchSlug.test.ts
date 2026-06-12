import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateResearchSlug, uniqueResearchSlug } from '../researchSlug';

describe('generateResearchSlug', () => {
  it('converts plain English to a safe slug', () => {
    expect(generateResearchSlug('Design folder agent portal')).toBe('design-folder-agent-portal');
  });

  it('strips Vietnamese diacritics', () => {
    const slug = generateResearchSlug('Thiết kế folder agent portal');
    expect(slug).toMatch(/^[a-z0-9-]+$/);
    expect(slug.length).toBeGreaterThan(0);
    expect(slug).toContain('thiet');
  });

  it('handles đ/Đ correctly', () => {
    const slug = generateResearchSlug('đường dẫn dự án');
    expect(slug).toContain('duong');
  });

  it('removes unsafe characters', () => {
    const slug = generateResearchSlug('hello/world../../secret');
    expect(slug).not.toContain('/');
    expect(slug).not.toContain('.');
  });

  it('caps at 48 characters', () => {
    const long = 'a'.repeat(100);
    expect(generateResearchSlug(long).length).toBeLessThanOrEqual(48);
  });

  it('collapses multiple hyphens', () => {
    const slug = generateResearchSlug('hello   world   test');
    expect(slug).toBe('hello-world-test');
  });

  it('falls back to "research" for empty input', () => {
    expect(generateResearchSlug('')).toBe('research');
  });

  it('falls back to "research" for pure special chars', () => {
    expect(generateResearchSlug('!!!@@@###')).toBe('research');
  });

  it('rejects slugs starting with double dots', () => {
    const slug = generateResearchSlug('../../../etc/passwd');
    expect(slug.startsWith('..')).toBe(false);
  });
});

describe('uniqueResearchSlug', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-slug-test-'));
    fs.mkdirSync(path.join(tmp, '.nexus', 'research'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('returns the base slug when folder does not exist', () => {
    expect(uniqueResearchSlug(tmp, 'design portal')).toBe('design-portal');
  });

  it('appends -2 when base slug folder already exists', () => {
    fs.mkdirSync(path.join(tmp, '.nexus', 'research', 'design-portal'), { recursive: true });
    expect(uniqueResearchSlug(tmp, 'design portal')).toBe('design-portal-2');
  });

  it('appends -3 when both -1 and -2 exist', () => {
    fs.mkdirSync(path.join(tmp, '.nexus', 'research', 'design-portal'), { recursive: true });
    fs.mkdirSync(path.join(tmp, '.nexus', 'research', 'design-portal-2'), { recursive: true });
    expect(uniqueResearchSlug(tmp, 'design portal')).toBe('design-portal-3');
  });
});
