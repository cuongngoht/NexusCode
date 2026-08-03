import type { IMcpClientAdapter } from './IMcpClientAdapter';
import type { McpPreset, McpToolDescriptor } from '../McpTypes';

type McpClient = {
  connect(transport: unknown): Promise<void>;
  close(): Promise<void>;
  callTool(input: { name: string; arguments: Record<string, unknown> }): Promise<{ content?: unknown }>;
  listTools(): Promise<{ tools?: unknown[] }>;
};

export class StreamableHttpMcpClientAdapter implements IMcpClientAdapter {
  async callTool(input: {
    preset: McpPreset;
    toolName: string;
    arguments: Record<string, unknown>;
    cwd?: string;
  }): Promise<string> {
    return this.withClient(input.preset, async client => {
      const result = await client.callTool({
        name: input.toolName,
        arguments: input.arguments,
      });
      return this.extractText(result.content);
    });
  }

  async listTools(input: { preset: McpPreset; cwd?: string }): Promise<McpToolDescriptor[]> {
    return this.withClient(input.preset, async client => {
      const result = await client.listTools();
      return toToolDescriptors(result.tools);
    });
  }

  private async withClient<T>(
    preset: McpPreset,
    fn: (client: McpClient) => Promise<T>,
  ): Promise<T> {
    if (!preset.endpoint) {
      throw new Error(`Missing endpoint for MCP preset: ${preset.id}`);
    }

    // Import dynamically to keep SDK isolated to adapters
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');

    // Custom servers may require auth headers (e.g. Authorization: Bearer ...)
    const transport = new StreamableHTTPClientTransport(new URL(preset.endpoint), {
      requestInit: preset.headers ? { headers: preset.headers } : undefined,
    });
    const client = new Client({ name: 'nexus-mcp-client', version: '1.0.0' });

    try {
      await client.connect(transport);
      return await fn(client as unknown as McpClient);
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

export function toToolDescriptors(tools: unknown[] | undefined): McpToolDescriptor[] {
  if (!Array.isArray(tools)) return [];
  return tools
    .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
    .filter(t => typeof t['name'] === 'string' && (t['name'] as string).length > 0)
    .map(t => ({
      name: String(t['name']),
      description: typeof t['description'] === 'string' ? t['description'] : undefined,
      inputSchema: (t['inputSchema'] ?? undefined) as McpToolDescriptor['inputSchema'],
    }));
}
