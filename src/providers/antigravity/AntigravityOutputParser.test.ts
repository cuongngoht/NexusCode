import { describe, it, expect } from 'vitest';
import { AntigravityOutputParser } from './AntigravityOutputParser';

describe('AntigravityOutputParser', () => {
  it('classifies "I will read" as read activity', () => {
    const parser = new AntigravityOutputParser();
    const acts = parser.parse('I will read package.json to check the scripts\n');
    const running = acts.find(a => a.status === 'running');
    expect(running).toBeDefined();
    expect(running!.kind).toBe('read');
  });

  it('closes previous activity when next "I will..." line arrives', () => {
    const parser = new AntigravityOutputParser();
    const acts = parser.parse(
      'I will read package.json\nI will run the tests\n',
    );
    const done = acts.filter(a => a.status === 'done' && a.kind !== 'plain');
    expect(done.length).toBe(1);
    expect(done[0].label).toContain('read package.json');
  });

  it('flush() closes the last pending activity so the UI chip does not stay "running" forever', () => {
    const parser = new AntigravityOutputParser();
    // The last "I will..." line has no successor to close it
    const acts = parser.parse('I will view PortalTalk.Processor.Tests.csproj\n');
    const running = acts.filter(a => a.status === 'running');
    expect(running.length).toBe(1);

    const flushed = parser.flush();
    expect(flushed.length).toBe(1);
    expect(flushed[0].status).toBe('done');
    expect(flushed[0].kind).toBe('read');
    expect(flushed[0].label).toContain('view PortalTalk');
  });

  it('flush() with no pending returns empty array', () => {
    const parser = new AntigravityOutputParser();
    parser.parse('Some plain output\n');
    expect(parser.flush()).toHaveLength(0);
  });

  it('flush() drains partial line buffer AND closes pending activity', () => {
    const parser = new AntigravityOutputParser();
    // Emit a line without newline — stays in buffer
    parser.parse('I will read the config');
    const flushed = parser.flush();
    // Must have at least one done activity
    const done = flushed.filter(a => a.status === 'done' && a.kind !== 'plain');
    expect(done.length).toBeGreaterThan(0);
    const last = flushed[flushed.length - 1];
    expect(last.status).toBe('done');
  });
});
