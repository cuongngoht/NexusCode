import type { IMcpClientAdapter } from './IMcpClientAdapter';
import type { McpPreset } from '../McpTypes';

export class StdioMcpClientAdapter implements IMcpClientAdapter {
  async callTool(input: {
    preset: McpPreset;
    toolName: string;
    arguments: Record<string, unknown>;
    cwd?: string;
  }): Promise<string> {
    if (!input.preset.command) {
      throw new Error(`Missing command for MCP preset: ${input.preset.id}`);
    }

    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');

    const env: Record<string, string> = { ...(process.env as Record<string, string>) };
    if (input.preset.env) {
      Object.assign(env, input.preset.env);
    }

    const transport = new StdioClientTransport({
      command: input.preset.command,
      args: input.preset.args ?? [],
      env,
      cwd: input.cwd,
    });

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
    // stdio process is created per-call, no persistent process to kill
  }
}
