import type { ExtensionMessage } from '../webviewProtocol';
import { ConfigService } from '../../config/ConfigService';
import type { IMcpPresetRegistry } from '../../mcp/McpPresetRegistry';
import type { McpPresetStatusView } from '../../mcp/McpTypes';

export class McpStatusHandler {
  constructor(
    private readonly post: (msg: ExtensionMessage) => void,
    private readonly configService: ConfigService,
    private readonly registry: IMcpPresetRegistry,
  ) {}

  async sendStatus(): Promise<void> {
    const config = await this.configService.loadConfig();
    const presets: McpPresetStatusView[] = this.registry.getAll().map(preset => ({
      id: preset.id,
      displayName: preset.displayName,
      enabled: config.mcp.presets[preset.id]?.enabled ?? preset.enabledByDefault,
      transport: preset.transport,
      risk: preset.risk,
    }));
    this.post({ type: 'mcpStatus', enabled: config.mcp.enabled, presets });
  }
}
