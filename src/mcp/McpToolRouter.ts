import type { McpPreset, McpRoute, McpToolIntent } from './McpTypes';

export interface IMcpToolRouter {
  route(intent: McpToolIntent, preset: McpPreset): McpRoute;
}

export class McpToolRouter implements IMcpToolRouter {
  route(intent: McpToolIntent, preset: McpPreset): McpRoute {
    if (preset.id === 'microsoftLearn') {
      return {
        presetId: preset.id,
        toolName: this.microsoftLearnTool(intent.group),
        arguments: { query: intent.query },
        reason: intent.reason,
      };
    }

    if (preset.id === 'context7') {
      return {
        presetId: preset.id,
        toolName: this.context7Tool(intent.group),
        arguments: { query: intent.query },
        reason: intent.reason,
      };
    }

    throw new Error(`Unsupported MCP preset: ${preset.id}`);
  }

  private microsoftLearnTool(group: string): string {
    if (group === 'samples') return 'microsoft_code_sample_search';
    return 'microsoft_docs_search';
  }

  private context7Tool(_group: string): string {
    return 'query-docs';
  }
}
