import type { IMcpClientAdapter } from './adapters/IMcpClientAdapter';
import type { McpPreset, McpRoute } from './McpTypes';

export interface IMcpBroker {
  call(input: {
    preset: McpPreset;
    route: McpRoute;
    cwd?: string;
  }): Promise<string>;
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
    const adapter =
      input.preset.transport === 'stdio'
        ? this.stdioAdapter
        : this.httpAdapter;

    return adapter.callTool({
      preset: input.preset,
      toolName: input.route.toolName,
      arguments: input.route.arguments,
      cwd: input.cwd,
    });
  }
}
