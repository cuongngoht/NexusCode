import type { ExtensionMessage } from '../webviewProtocol';
import { ConfigService } from '../../config/ConfigService';
import { buildCustomPresets } from '../../mcp/McpCustomServers';
import type { IMcpPresetRegistry } from '../../mcp/McpPresetRegistry';
import type { McpBuiltinPresetId, McpPresetStatusView } from '../../mcp/McpTypes';

export class McpStatusHandler {
  constructor(
    private readonly post: (msg: ExtensionMessage) => void,
    private readonly configService: ConfigService,
    private readonly registry: IMcpPresetRegistry,
  ) {}

  async sendStatus(): Promise<void> {
    const config = await this.configService.loadConfig();
    const builtin: McpPresetStatusView[] = this.registry.getAll().map(preset => ({
      id: preset.id,
      displayName: preset.displayName,
      enabled: config.mcp.presets[preset.id as McpBuiltinPresetId]?.enabled ?? preset.enabledByDefault,
      transport: preset.transport,
      risk: preset.risk,
    }));
    const custom: McpPresetStatusView[] = buildCustomPresets(config.mcp.customServers).map(entry => ({
      id: entry.preset.id,
      displayName: entry.preset.displayName,
      enabled: entry.enabled,
      transport: entry.preset.transport,
      risk: entry.preset.risk,
    }));
    this.post({ type: 'mcpStatus', enabled: config.mcp.enabled, presets: [...builtin, ...custom] });
  }
}
