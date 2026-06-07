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
});
