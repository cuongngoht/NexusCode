import type { IMcpClientAdapter } from './IMcpClientAdapter';
import type { McpPreset, McpToolDescriptor } from '../McpTypes';
import { toToolDescriptors } from './StreamableHttpMcpClientAdapter';

type McpClient = {
  connect(transport: unknown): Promise<void>;
  close(): Promise<void>;
  callTool(input: { name: string; arguments: Record<string, unknown> }): Promise<{ content?: unknown }>;
  listTools(): Promise<{ tools?: unknown[] }>;
};

export class StdioMcpClientAdapter implements IMcpClientAdapter {
  async callTool(input: {
    preset: McpPreset;
    toolName: string;
    arguments: Record<string, unknown>;
    cwd?: string;
  }): Promise<string> {
    return this.withClient(input.preset, input.cwd, async client => {
      const result = await client.callTool({
        name: input.toolName,
        arguments: input.arguments,
      });
      return this.extractText(result.content);
    });
  }

  async listTools(input: { preset: McpPreset; cwd?: string }): Promise<McpToolDescriptor[]> {
    return this.withClient(input.preset, input.cwd, async client => {
      const result = await client.listTools();
      return toToolDescriptors(result.tools);
    });
  }

  private async withClient<T>(
    preset: McpPreset,
    cwd: string | undefined,
    fn: (client: McpClient) => Promise<T>,
  ): Promise<T> {
    if (!preset.command) {
      throw new Error(`Missing command for MCP preset: ${preset.id}`);
    }

    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');

    const env: Record<string, string> = { ...(process.env as Record<string, string>) };
    if (preset.env) {
      Object.assign(env, preset.env);
    }

    const transport = new StdioClientTransport({
      command: preset.command,
      args: preset.args ?? [],
      env,
      cwd,
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
    // stdio process is created per-call, no persistent process to kill
  }
}
