import type { McpPreset } from '../McpTypes';

export interface IMcpClientAdapter {
  callTool(input: {
    preset: McpPreset;
    toolName: string;
    arguments: Record<string, unknown>;
    cwd?: string;
  }): Promise<string>;

  dispose?(): Promise<void>;
}
