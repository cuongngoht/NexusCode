import { describe, it, expect } from 'vitest';
import { McpIntentParser } from './McpIntentParser';

const parser = new McpIntentParser();

describe('McpIntentParser', () => {
  it('parses a valid intent block', () => {
    const text = `
Some agent output here.
<NEXUS_TOOL_INTENT>
{
  "group": "docs",
  "query": "react hooks documentation",
  "reason": "Need docs for useEffect"
}
</NEXUS_TOOL_INTENT>
More text here.
`;
    const result = parser.parse(text);
    expect(result).toEqual({
      group: 'docs',
      query: 'react hooks documentation',
      reason: 'Need docs for useEffect',
    });
  });

  it('returns undefined when no block present', () => {
    const text = 'Just some plain output with no intent block.';
    expect(parser.parse(text)).toBeUndefined();
  });

  it('returns undefined for invalid JSON', () => {
    const text = `
<NEXUS_TOOL_INTENT>
{ invalid json here
</NEXUS_TOOL_INTENT>
`;
    expect(parser.parse(text)).toBeUndefined();
  });

  it('returns undefined for unknown group', () => {
    const text = `
<NEXUS_TOOL_INTENT>
{
  "group": "unknown-group",
  "query": "something",
  "reason": "some reason"
}
</NEXUS_TOOL_INTENT>
`;
    expect(parser.parse(text)).toBeUndefined();
  });

  it('truncates query longer than 500 chars', () => {
    const longQuery = 'a'.repeat(600);
    const text = `
<NEXUS_TOOL_INTENT>
{
  "group": "samples",
  "query": "${longQuery}",
  "reason": "short reason"
}
</NEXUS_TOOL_INTENT>
`;
    const result = parser.parse(text);
    expect(result).not.toBeUndefined();
    expect(result!.query.length).toBe(500);
  });

  it('truncates reason longer than 500 chars', () => {
    const longReason = 'b'.repeat(600);
    const text = `
<NEXUS_TOOL_INTENT>
{
  "group": "library-api",
  "query": "short query",
  "reason": "${longReason}"
}
</NEXUS_TOOL_INTENT>
`;
    const result = parser.parse(text);
    expect(result).not.toBeUndefined();
    expect(result!.reason.length).toBe(500);
  });

  it('accepts all valid group values', () => {
    const groups = ['docs', 'samples', 'library-api', 'microsoft-docs'] as const;
    for (const group of groups) {
      const text = `<NEXUS_TOOL_INTENT>{"group":"${group}","query":"q","reason":"r"}</NEXUS_TOOL_INTENT>`;
      expect(parser.parse(text)).not.toBeUndefined();
    }
  });

  it('returns undefined when required fields are missing', () => {
    const text = `
<NEXUS_TOOL_INTENT>
{
  "group": "docs"
}
</NEXUS_TOOL_INTENT>
`;
    expect(parser.parse(text)).toBeUndefined();
  });

  describe('multiple blocks', () => {
    // The instruction Nexus injects *contains* a template block. Any CLI that echoes its
    // prompt to stdout therefore puts `"group": "<group>"` ahead of the model's real
    // request — taking the first match would fail the group check and lose the intent
    // entirely, making MCP look broken for that provider.
    it('skips the echoed instruction template and returns the real intent', () => {
      const text = `
## External Documentation (MCP)
<NEXUS_TOOL_INTENT>
{"group": "<group>", "query": "<search terms>", "reason": "<why you need this>"}
</NEXUS_TOOL_INTENT>

Now my actual answer.
<NEXUS_TOOL_INTENT>
{"group": "docs", "query": "azure functions python v2", "reason": "need current decorators"}
</NEXUS_TOOL_INTENT>
`;
      expect(parser.parse(text)).toEqual({
        group: 'docs',
        query: 'azure functions python v2',
        reason: 'need current decorators',
      });
    });

    it('returns the last valid intent when several are valid', () => {
      const text = `
<NEXUS_TOOL_INTENT>{"group":"docs","query":"first","reason":"r1"}</NEXUS_TOOL_INTENT>
<NEXUS_TOOL_INTENT>{"group":"samples","query":"second","reason":"r2"}</NEXUS_TOOL_INTENT>
`;
      expect(parser.parse(text)?.query).toBe('second');
    });

    it('falls back to an earlier valid block when the last one is malformed', () => {
      const text = `
<NEXUS_TOOL_INTENT>{"group":"docs","query":"good","reason":"r"}</NEXUS_TOOL_INTENT>
<NEXUS_TOOL_INTENT>{ not json </NEXUS_TOOL_INTENT>
`;
      expect(parser.parse(text)?.query).toBe('good');
    });
  });

  describe('transport boundaries', () => {
    // Documents why the collector must be fed decoded content: a tag still wrapped in a
    // JSONL envelope is not parseable, so collecting raw frames loses the intent.
    it('cannot read an intent still escaped inside a raw JSONL frame', () => {
      const raw = JSON.stringify({
        type: 'item.completed',
        item: {
          type: 'agent_message',
          text: '<NEXUS_TOOL_INTENT>\n{"group":"docs","query":"q","reason":"r"}\n</NEXUS_TOOL_INTENT>',
        },
      });
      expect(parser.parse(raw)).toBeUndefined();
    });

    it('reads the same intent once the frame has been decoded to text', () => {
      const decoded = '<NEXUS_TOOL_INTENT>\n{"group":"docs","query":"q","reason":"r"}\n</NEXUS_TOOL_INTENT>';
      expect(parser.parse(decoded)?.query).toBe('q');
    });
  });
});
