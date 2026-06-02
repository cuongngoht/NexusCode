import { describe, expect, it } from 'vitest';
import { AiderAdapter } from './aider/AiderAdapter';
import { ClaudeAdapter } from './claude/ClaudeAdapter';
import { CodexAdapter } from './codex/CodexAdapter';
import { CopilotAdapter } from './copilot/CopilotAdapter';
import { GeminiAdapter } from './gemini/GeminiAdapter';

describe('provider adapters', () => {
  it('passes selected models to Claude', () => {
    expect(new ClaudeAdapter().buildCommand('fix it', { model: 'sonnet' })).toEqual({
      command: 'claude',
      args: ['--model', 'sonnet', 'fix it'],
    });
  });

  it('passes selected models to Codex', () => {
    expect(new CodexAdapter().buildCommand('fix it', { model: 'gpt-5.2' })).toEqual({
      command: 'codex',
      args: ['--model', 'gpt-5.2', 'fix it'],
    });
  });

  it('uses non-interactive prompt args for Gemini', () => {
    expect(new GeminiAdapter().buildCommand('fix it', { model: 'gemini-2.5-pro' })).toEqual({
      command: 'gemini',
      args: ['--model', 'gemini-2.5-pro', '--prompt', 'fix it'],
    });
  });

  it('uses non-interactive prompt args for Copilot', () => {
    expect(new CopilotAdapter().buildCommand('fix it', { model: 'gpt-5.2' })).toEqual({
      command: 'copilot',
      args: ['--model', 'gpt-5.2', '--prompt', 'fix it'],
    });
  });

  it('passes selected models to Aider', () => {
    expect(new AiderAdapter().buildCommand('fix it', { model: 'sonnet' })).toEqual({
      command: 'aider',
      args: ['--model', 'sonnet', '--message', 'fix it'],
    });
  });

  it('keeps default model behavior when no model is selected', () => {
    expect(new ClaudeAdapter().buildCommand('fix it')).toEqual({
      command: 'claude',
      args: ['fix it'],
    });
  });
});
