import { describe, expect, it } from 'vitest';
import { CodexOutputParser } from './CodexOutputParser';

describe('CodexOutputParser', () => {
  it('suppresses startup banner + header and shows response', () => {
    const parser = new CodexOutputParser();

    const activities = parser.parse([
      'Reading additional input from stdin...',
      'OpenAI Codex v0.130.0',
      '--------',
      'workdir: /repo',
      'model: gpt-5.5',
      'provider: openai',
      'approval: never',
      'sandbox: workspace-write [workdir, /tmp]',
      'reasoning effort: high',
      'reasoning summaries: none',
      'session id: 019eb0c1-a24b-78c2-913c-6a0a086f4c04',
      '--------',
      'Here is the actual answer.',
      '',
    ].join('\n'));

    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({ kind: 'plain', raw: 'Here is the actual answer.' });
  });

  it('suppresses the echoed user prompt block and shows only the Codex response', () => {
    const parser = new CodexOutputParser();

    // Codex echoes the full enhanced prompt back as a "user" conversation turn
    // before streaming its actual response.
    const activities = parser.parse([
      'Reading additional input from stdin...',
      'OpenAI Codex v0.130.0',
      '--------',
      'workdir: /Users/cuongngoht/Repo/PortalTalk.NF',
      'model: gpt-5.5',
      'provider: openai',
      'approval: never',
      'sandbox: workspace-write [workdir, /tmp]',
      'reasoning effort: high',
      'reasoning summaries: none',
      'session id: 019eb0ca-8d9c-7b42-8e09-51d3c1bbfb13',
      '--------',
      'user',
      'You are working in the directory: /Users/cuongngoht/Repo/PortalTalk.NF',
      'ALWAYS use absolute paths when calling any file tool.',
      '# Task',
      'show only what is necessary',
      '--------',
      'Of course! Here is the response.',
      '',
    ].join('\n'));

    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({ kind: 'plain', raw: 'Of course! Here is the response.' });
  });

  it('suppresses multi-turn conversation history (user + assistant + user)', () => {
    const parser = new CodexOutputParser();

    const activities = parser.parse([
      'OpenAI Codex v0.130.0',
      '--------',
      'workdir: /repo',
      '--------',
      'user',
      'First question.',
      '--------',
      'assistant',
      'First answer.',
      '--------',
      'user',
      'Follow-up question.',
      '--------',
      'Actual streaming response.',
      '',
    ].join('\n'));

    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({ kind: 'plain', raw: 'Actual streaming response.' });
  });

  it('passes normal output through as plain text when no startup banner is present', () => {
    const parser = new CodexOutputParser();

    const activities = parser.parse('A normal response line.\n');

    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({ kind: 'plain', raw: 'A normal response line.' });
  });

  it('emits conversational NL phrases as plain text, never as activity chips', () => {
    const parser = new CodexOutputParser();

    const activities = parser.parse(
      "I'll read the file first.\nAnalyzing your code structure.\nReading package.json...\n"
    );

    expect(activities).toHaveLength(3);
    for (const act of activities) {
      expect(act.kind).toBe('plain');
    }
  });

  it('strips ANSI codes from banner lines before filtering', () => {
    const parser = new CodexOutputParser();

    const activities = parser.parse([
      '\x1B[1mOpenAI Codex v0.130.0\x1B[0m',
      '--------',
      'workdir: /repo',
      '--------',
      'Answer here.',
      '',
    ].join('\n'));

    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({ kind: 'plain', raw: 'Answer here.' });
  });

  it('handles separator with varying dash count', () => {
    const parser = new CodexOutputParser();

    const activities = parser.parse([
      'OpenAI Codex v0.131.0',
      '----------',
      'workdir: /repo',
      '----------',
      'Done.',
      '',
    ].join('\n'));

    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({ kind: 'plain', raw: 'Done.' });
  });
});
