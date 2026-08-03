import type { McpPreset, McpToolDescriptor } from '../McpTypes';

export interface IMcpClientAdapter {
  callTool(input: {
    preset: McpPreset;
    toolName: string;
    arguments: Record<string, unknown>;
    cwd?: string;
  }): Promise<string>;

  /** Lists the tools advertised by the server (MCP tools/list). */
  listTools(input: { preset: McpPreset; cwd?: string }): Promise<McpToolDescriptor[]>;

  dispose?(): Promise<void>;
}
