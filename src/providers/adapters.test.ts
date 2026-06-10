import { describe, expect, it } from 'vitest';
import { AiderAgent } from './aider/AiderAgent';
import { ClaudeAgent } from './claude/ClaudeAgent';
import { CodexAgent } from './codex/CodexAgent';
import { CopilotAgent } from './copilot/CopilotAgent';
import { AntigravityAgent } from './antigravity/AntigravityAgent';
import { GrokAgent } from './grok/GrokAgent';
import { AgentTask } from '../core/agent';

function makeTask(prompt: string, model?: string): AgentTask {
  return new AgentTask(prompt, prompt, 'claude', 'ask', model);
}

describe('provider agents', () => {
  it('passes selected model to Claude', () => {
    const cmd = new ClaudeAgent().buildCommand(makeTask('fix it', 'sonnet'));
    expect(cmd.executable).toBe('claude');
    expect(cmd.args).toEqual(['--dangerously-skip-permissions', '--model', 'sonnet', 'fix it']);
  });

  it('passes selected model to Codex', () => {
    const cmd = new CodexAgent().buildCommand(makeTask('fix it', 'gpt-5.2'));
    expect(cmd.executable).toBe('codex');
    expect(cmd.args).toEqual([
      '--ask-for-approval',
      'never',
      '--sandbox',
      'workspace-write',
      'exec',
      '--model',
      'gpt-5.2',
      'fix it',
    ]);
  });

  it('uses non-interactive prompt args for Antigravity with model', () => {
    const cmd = new AntigravityAgent().buildCommand(makeTask('fix it', 'gemini-3.5-pro'));
    expect(cmd.executable).toBe('agy');
    expect(cmd.args).toEqual(['--model', 'gemini-3.5-pro', '--prompt', 'fix it', '--dangerously-skip-permissions']);
  });

  it('uses non-interactive prompt args for Antigravity without model', () => {
    const cmd = new AntigravityAgent().buildCommand(makeTask('fix it'));
    expect(cmd.executable).toBe('agy');
    expect(cmd.args).toEqual(['--prompt', 'fix it', '--dangerously-skip-permissions']);
  });

  it('uses non-interactive prompt args for Copilot', () => {
    const cmd = new CopilotAgent().buildCommand(makeTask('fix it', 'gpt-5.2'));
    expect(cmd.executable).toBe('copilot');
    expect(cmd.args).toEqual(['--model', 'gpt-5.2', '--prompt', 'fix it']);
  });

  it('passes selected model to Aider', () => {
    const cmd = new AiderAgent().buildCommand(makeTask('fix it', 'sonnet'));
    expect(cmd.executable).toBe('aider');
    expect(cmd.args).toEqual(['--yes', '--model', 'sonnet', '--message', 'fix it']);
  });

  it('passes selected model to Grok', () => {
    const cmd = new GrokAgent().buildCommand(makeTask('fix it', 'grok-3'));
    expect(cmd.executable).toBe('grok');
    expect(cmd.args).toEqual(['--model', 'grok-3', '--single', 'fix it']);
  });

  it('omits --model when no model is selected for Claude', () => {
    const cmd = new ClaudeAgent().buildCommand(makeTask('fix it'));
    expect(cmd.executable).toBe('claude');
    expect(cmd.args).toEqual(['--dangerously-skip-permissions', 'fix it']);
  });

  it('omits --model when no model is selected for Codex', () => {
    const cmd = new CodexAgent().buildCommand(makeTask('fix it'));
    expect(cmd.executable).toBe('codex');
    expect(cmd.args).toEqual([
      '--ask-for-approval',
      'never',
      '--sandbox',
      'workspace-write',
      'exec',
      'fix it',
    ]);
  });

  it('omits --model when no model is selected for Grok', () => {
    const cmd = new GrokAgent().buildCommand(makeTask('fix it'));
    expect(cmd.executable).toBe('grok');
    expect(cmd.args).toEqual(['--single', 'fix it']);
  });
});
