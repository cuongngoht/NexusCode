import type { IMcpClientAdapter } from './IMcpClientAdapter';
import type { McpPreset } from '../McpTypes';

export class StreamableHttpMcpClientAdapter implements IMcpClientAdapter {
  async callTool(input: {
    preset: McpPreset;
    toolName: string;
    arguments: Record<string, unknown>;
    cwd?: string;
  }): Promise<string> {
    if (!input.preset.endpoint) {
      throw new Error(`Missing endpoint for MCP preset: ${input.preset.id}`);
    }

    // Import dynamically to keep SDK isolated to adapters
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');

    const transport = new StreamableHTTPClientTransport(new URL(input.preset.endpoint));
    const client = new Client({ name: 'nexus-mcp-client', version: '1.0.0' });

    try {
      await client.connect(transport);
      const result = await client.callTool({
        name: input.toolName,
        arguments: input.arguments,
      });

      return this.extractText(result.content);
    } finally {
      await client.close();
    }
  }

  private extractText(content: unknown): string {
    if (!content || !Array.isArray(content)) return '';
    return content
      .filter((c: unknown) => typeof c === 'object' && c !== null && (c as Record<string, unknown>)['type'] === 'text')
      .map((c: unknown) => String((c as Record<string, unknown>)['text'] ?? ''))
      .join('\n');
  }

  async dispose(): Promise<void> {
    // No persistent connection to clean up for HTTP
  }
}
