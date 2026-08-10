import { MCP_TOOL_GROUPS, NEXUS_TOOL_INTENT_TAG } from '../core/mcp/McpIntentProtocol';
import type { McpToolIntent } from './McpTypes';

export interface IMcpIntentParser {
  parse(text: string): McpToolIntent | undefined;
}

const INTENT_BLOCK_RE = new RegExp(
  `<${NEXUS_TOOL_INTENT_TAG}>\\s*([\\s\\S]*?)\\s*</${NEXUS_TOOL_INTENT_TAG}>`,
  'g',
);

export class McpIntentParser implements IMcpIntentParser {
  /**
   * Returns the LAST valid intent, not the first.
   *
   * The instruction we inject contains a template block with `"group": "<group>"`, so
   * any CLI that echoes its prompt to stdout puts that template ahead of the model's
   * real request. Taking the first match would fail the group check and lose the
   * intent entirely; the model's actual answer always comes after the echoed prompt.
   */
  parse(text: string): McpToolIntent | undefined {
    let latest: McpToolIntent | undefined;

    for (const match of text.matchAll(INTENT_BLOCK_RE)) {
      const intent = this._parseBlock(match[1]);
      if (intent) latest = intent;
    }

    return latest;
  }

  private _parseBlock(body: string): McpToolIntent | undefined {
    try {
      const parsed = JSON.parse(body) as Partial<McpToolIntent>;

      if (!parsed.group || !parsed.query || !parsed.reason) {
        return undefined;
      }

      if (!MCP_TOOL_GROUPS.includes(parsed.group as (typeof MCP_TOOL_GROUPS)[number])) {
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
