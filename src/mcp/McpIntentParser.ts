import type { McpToolGroup, McpToolIntent } from './McpTypes';

export interface IMcpIntentParser {
  parse(text: string): McpToolIntent | undefined;
}

const ALLOWED_GROUPS: McpToolGroup[] = [
  'docs',
  'samples',
  'library-api',
  'microsoft-docs',
];

export class McpIntentParser implements IMcpIntentParser {
  parse(text: string): McpToolIntent | undefined {
    const match = text.match(/<NEXUS_TOOL_INTENT>\s*([\s\S]*?)\s*<\/NEXUS_TOOL_INTENT>/);
    if (!match) return undefined;

    try {
      const parsed = JSON.parse(match[1]) as Partial<McpToolIntent>;

      if (!parsed.group || !parsed.query || !parsed.reason) {
        return undefined;
      }

      if (!ALLOWED_GROUPS.includes(parsed.group)) {
        return undefined;
      }

      return {
        group: parsed.group,
        query: String(parsed.query).slice(0, 500),
        reason: String(parsed.reason).slice(0, 500),
      };
    } catch {
      return undefined;
    }
  }
}
