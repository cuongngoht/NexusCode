import type { IMcpClientAdapter } from './adapters/IMcpClientAdapter';
import type { McpPreset, McpRoute, McpToolDescriptor } from './McpTypes';

export interface IMcpBroker {
  call(input: {
    preset: McpPreset;
    route: McpRoute;
    cwd?: string;
  }): Promise<string>;

  listTools(input: { preset: McpPreset; cwd?: string }): Promise<McpToolDescriptor[]>;
}

export class McpBroker implements IMcpBroker {
  constructor(
    private readonly stdioAdapter: IMcpClientAdapter,
    private readonly httpAdapter: IMcpClientAdapter,
  ) {}

  async call(input: {
    preset: McpPreset;
    route: McpRoute;
    cwd?: string;
  }): Promise<string> {
    return this.adapterFor(input.preset).callTool({
      preset: input.preset,
      toolName: input.route.toolName,
      arguments: input.route.arguments,
      cwd: input.cwd,
    });
  }

  async listTools(input: { preset: McpPreset; cwd?: string }): Promise<McpToolDescriptor[]> {
    return this.adapterFor(input.preset).listTools({
      preset: input.preset,
      cwd: input.cwd,
    });
  }

  private adapterFor(preset: McpPreset): IMcpClientAdapter {
    return preset.transport === 'stdio' ? this.stdioAdapter : this.httpAdapter;
  }
}
