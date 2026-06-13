import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  loadPromptMarkdown,
  loadModeInstruction,
  loadWorkflowPrompt,
  loadGatePrompt,
  loadOutputFormat,
  loadRecommendationPrompt,
} from '../promptLibrary';

// Extension root is the project root (src/context/__tests__ → ../../..)
const EXTENSION_ROOT = path.join(__dirname, '../../..');

// ── bundled prompt loading ────────────────────────────────────────────────────

describe('loadPromptMarkdown – bundled', () => {
  it('loads a bundled mode file from media/prompts', () => {
    const result = loadPromptMarkdown('modes', 'ask', { extensionRoot: EXTENSION_ROOT });
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('Answer the user');
  });

  it('returns fallback when file is missing and no workspace override', () => {
    const result = loadPromptMarkdown('modes', 'nonexistent', {
      extensionRoot: EXTENSION_ROOT,
      fallback: 'default text',
    });
    expect(result).toBe('default text');
  });

  it('returns empty string when no file and no fallback', () => {
    const result = loadPromptMarkdown('modes', 'nonexistent', {
      extensionRoot: EXTENSION_ROOT,
    });
    expect(result).toBe('');
  });
});

// ── workspace override ────────────────────────────────────────────────────────

describe('loadPromptMarkdown – workspace override', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-prompt-test-'));
    const dir = path.join(tmp, '.nexus', 'prompts', 'modes');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'plan.md'), 'Custom plan guidance from workspace.');
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('prefers workspace override over bundled file', () => {
    const result = loadPromptMarkdown('modes', 'plan', {
      workspaceRoot: tmp,
      extensionRoot: EXTENSION_ROOT,
      fallback: 'fallback',
    });
    expect(result).toBe('Custom plan guidance from workspace.');
  });

  it('falls back to bundled when workspace file is absent', () => {
    const result = loadPromptMarkdown('modes', 'ask', {
      workspaceRoot: tmp,
      extensionRoot: EXTENSION_ROOT,
    });
    expect(result).toContain('Answer the user');
  });
});

// ── loadModeInstruction ───────────────────────────────────────────────────────

describe('loadModeInstruction', () => {
  it('returns bundled markdown for plan mode', () => {
    const result = loadModeInstruction('plan', { extensionRoot: EXTENSION_ROOT });
    expect(result).toContain('implementation plan');
  });

  it('returns bundled markdown for scan-project mode', () => {
    const result = loadModeInstruction('scan-project', { extensionRoot: EXTENSION_ROOT });
    expect(result).toContain('Project Discovery');
  });

  it('returns non-empty fallback when no extensionRoot provided', () => {
    const result = loadModeInstruction('edit');
    expect(result).toContain('code changes');
  });

  it('workspace override takes precedence for mode instructions', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-mode-test-'));
    try {
      const dir = path.join(tmp, '.nexus', 'prompts', 'modes');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'edit.md'), 'Override: apply minimal changes only.');
      const result = loadModeInstruction('edit', {
        workspaceRoot: tmp,
        extensionRoot: EXTENSION_ROOT,
      });
      expect(result).toBe('Override: apply minimal changes only.');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ── Product Owner prompts ─────────────────────────────────────────────────────

describe('loadGatePrompt – product-owner-clarification-gate', () => {
  it('contains the NEXUS_PO_INPUT_REQUIRED marker', () => {
    const result = loadGatePrompt('product-owner-clarification-gate', {
      extensionRoot: EXTENSION_ROOT,
    });
    expect(result).toContain('<!-- NEXUS_PO_INPUT_REQUIRED -->');
  });
});

describe('loadWorkflowPrompt – product-owner', () => {
  it('loads the product-owner workflow prompt', () => {
    const result = loadWorkflowPrompt('product-owner', { extensionRoot: EXTENSION_ROOT });
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('Product Owner');
  });
});

describe('loadOutputFormat – product-owner', () => {
  it('loads the product-owner output format', () => {
    const result = loadOutputFormat('product-owner', { extensionRoot: EXTENSION_ROOT });
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('loadRecommendationPrompt – product-owner', () => {
  it('loads the product-owner recommendations prompt', () => {
    const result = loadRecommendationPrompt('product-owner', { extensionRoot: EXTENSION_ROOT });
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('Recommended MVP scope');
  });
});

// ── path traversal guard ──────────────────────────────────────────────────────

describe('loadPromptMarkdown – path traversal guard', () => {
  it('throws on path traversal in category', () => {
    expect(() => loadPromptMarkdown('../etc', 'passwd')).toThrow('category');
  });

  it('throws on path traversal in name', () => {
    expect(() => loadPromptMarkdown('modes', '../secret')).toThrow('name');
  });

  it('throws on absolute path in name', () => {
    expect(() => loadPromptMarkdown('modes', '/etc/passwd')).toThrow('name');
  });

  it('throws on shell metacharacters in category', () => {
    expect(() => loadPromptMarkdown('modes;ls', 'ask')).toThrow('category');
  });
});
