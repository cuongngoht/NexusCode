import { describe, expect, it } from 'vitest';
import { AiderAgent } from './aider/AiderAgent';
import { ClaudeAgent } from './claude/ClaudeAgent';
import { CodexAgent } from './codex/CodexAgent';
import { CopilotAgent } from './copilot/CopilotAgent';
import { AntigravityAgent } from './antigravity/AntigravityAgent';
import { GrokAgent } from './grok/GrokAgent';
import { AgentTask } from '../core/agent';

function makeTask(prompt: string, model?: string): AgentTask {
  return new AgentTask(prompt, prompt, 'auto', 'ask', model);
}

describe('provider agents', () => {
  it('passes selected model to Claude', () => {
    const cmd = new ClaudeAgent().buildCommand(makeTask('fix it', 'sonnet'));
    expect(cmd.executable).toBe('claude');
    expect(cmd.args).toEqual(['--dangerously-skip-permissions', '--model', 'sonnet', 'fix it']);
  });

  it('passes selected model to Codex (legacy CLI without --json)', () => {
    // jsonOutputOverride=false pins the legacy path — keeps the test
    // independent of whichever codex binary is installed locally.
    const cmd = new CodexAgent(false).buildCommand(makeTask('fix it', 'gpt-5.2'));
    expect(cmd.executable).toBe('codex');
    expect(cmd.transport).toBeUndefined();
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

  it('adds --json and jsonl transport when Codex CLI supports it', () => {
    const cmd = new CodexAgent(true).buildCommand(makeTask('fix it', 'gpt-5.2'));
    expect(cmd.executable).toBe('codex');
    expect(cmd.transport).toBe('jsonl');
    expect(cmd.args).toEqual([
      '--ask-for-approval',
      'never',
      '--sandbox',
      'workspace-write',
      'exec',
      '--json',
      '--model',
      'gpt-5.2',
      'fix it',
    ]);
  });

  it('uses --experimental-json for intermediate Codex builds', () => {
    const cmd = new CodexAgent('experimental').buildCommand(makeTask('fix it', 'gpt-5.2'));
    expect(cmd.transport).toBe('jsonl');
    expect(cmd.args).toContain('--experimental-json');
    expect(cmd.args).not.toContain('--json');
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
    const cmd = new CodexAgent(false).buildCommand(makeTask('fix it'));
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

import { NLOutputParser } from './base/NLOutputParser';

describe('NLOutputParser (extract activities from NL to show "grok cli đang làm gì")', () => {
  it('extracts review-style and architect narrative as activities (to surface what the CLI is doing)', () => {
    const parser = new NLOutputParser();
    const input = [
      "Reviewing the Nexus codebase for design patterns...",
      "Analyzing the @software-architect and #design-patterns guidance.",
      "Generating the evaluation report for the user.",
      "Here is the detailed assessment of the architecture.",
    ].join('\n');

    const acts = parser.parse(input);
    // These become activities so the UI can show "grok cli đang làm gì" as chips
    // (e.g. under Nexus · Hỏi đáp step). The full text is still rendered because
    // RunAgentUseCase always emits the raw chunk as stdout.
    const nonPlains = acts.filter(a => a.kind !== 'plain');
    expect(nonPlains.length).toBeGreaterThan(0);
    // At least the review/eval phrases should have triggered activities
    const hasReviewActivity = nonPlains.some(a =>
      a.label && (a.label.includes('Reviewing') || a.label.includes('Analyzing') || a.label.includes('Generating'))
    );
    expect(hasReviewActivity).toBe(true);
  });

  it('still extracts activities for short imperative progress (Aider/Copilot/Grok tool use cases)', () => {
    const parser = new NLOutputParser();
    // Pure action lines → activities (the "đang làm gì" chips)
    const input = "Reading package.json...\nI'll edit src/index.ts now\n> Applying changes";
    const acts = parser.parse(input);
    const nonPlains = acts.filter(a => a.kind !== 'plain');
    expect(nonPlains.length).toBeGreaterThan(0);
  });

  it('extracts activity for long evaluative lines that start with a verb (so UI shows the step)', () => {
    const parser = new NLOutputParser();
    // Trailing \n to get a complete line from the buffer logic.
    const line = "Reviewing the provided prompt attachments and previous conversation context in detail reveals several opportunities.\n";
    const acts = parser.parse(line);
    expect(acts.length).toBeGreaterThan(0);
    // Now classified as activity (to show "đang làm gì"), full text still safe via raw emit
    expect(acts[0].kind).not.toBe('plain');
    expect(acts[0].label).toContain('Reviewing the provided prompt');
  });

  it('mixed progress + prose yields activities (for visibility of what CLI is doing)', () => {
    const parser = new NLOutputParser();
    // "Reading..." → activity (đang làm gì chip)
    // "Reviewing..." → activity (đang làm gì chip)
    // The full text of both will appear in the UI body via raw stdout emit.
    const input = "Reading the files...\nReviewing the design patterns in the augmented prompt reveals several issues.\n";
    const acts = parser.parse(input);
    expect(acts.some(a => a.kind !== 'plain')).toBe(true); // activity chip(s) for "grok cli đang làm gì"
  });

  it('flush() closes the last pending activity so the UI chip does not stay "running" forever', () => {
    const parser = new NLOutputParser();
    // "Analyzing..." starts a pending activity but there is no following line to close it
    const acts = parser.parse("Analyzing the codebase structure.\n");
    const running = acts.filter(a => a.status === 'running');
    expect(running.length).toBe(1);

    // Before flush: pending activity is still open
    const flushed = parser.flush();
    expect(flushed.length).toBe(1);
    expect(flushed[0].status).toBe('done');
    expect(flushed[0].label).toContain('Analyzing');
  });

  it('flush() drains a partial line from the buffer that was never terminated with \\n', () => {
    const parser = new NLOutputParser();
    // Chunk without trailing newline — stays in _lineBuffer
    parser.parse("Reading package.json");
    const flushed = parser.flush();
    // The partial line should surface as an activity (running) then immediately done
    const nonPlains = flushed.filter(a => a.kind !== 'plain');
    expect(nonPlains.length).toBeGreaterThan(0);
    // Last emitted for that activity must be 'done'
    const last = flushed[flushed.length - 1];
    expect(last.status).toBe('done');
  });
});
