import type { NexusConfig } from '../config/NexusConfig';
import type { AgentTask } from '../core/agent';
import type { IMcpBroker } from './McpBroker';
import type { IMcpExecutionPolicy } from './McpExecutionPolicy';
import type { IMcpIntentParser } from './McpIntentParser';
import type { IMcpPresetRegistry } from './McpPresetRegistry';
import type { IMcpPresetSelectionPolicy } from './McpPresetSelectionPolicy';
import type { IMcpResultCompressor } from './McpResultCompressor';
import type { IMcpToolRouter } from './McpToolRouter';

export class McpToolUseCase {
  constructor(
    private readonly registry: IMcpPresetRegistry,
    private readonly selector: IMcpPresetSelectionPolicy,
    private readonly router: IMcpToolRouter,
    private readonly parser: IMcpIntentParser,
    private readonly policy: IMcpExecutionPolicy,
    private readonly broker: IMcpBroker,
    private readonly compressor: IMcpResultCompressor,
  ) {}

  async tryHandleToolIntent(input: {
    task: AgentTask;
    output: string;
    config: NexusConfig;
  }): Promise<string | undefined> {
    const intent = this.parser.parse(input.output);
    if (!intent) return undefined;

    const enabledPresets = this.registry.getAll().filter(preset => {
      if (preset.id === 'microsoftLearn') {
        return input.config.mcp.presets.microsoftLearn.enabled;
      }
      if (preset.id === 'context7') {
        return input.config.mcp.presets.context7.enabled;
      }
      return false;
    });

    const preset = this.selector.select({
      prompt: input.task.prompt,
      mode: input.task.mode,
      intent,
      enabledPresets,
    });

    if (!preset) {
      return ['## MCP Request Rejected', 'No enabled MCP preset can satisfy this request.'].join('\n');
    }

    const route = this.router.route(intent, preset);

    const decision = this.policy.evaluate({
      mode: input.task.mode,
      preset,
      route,
      mcpEnabled: input.config.mcp.enabled,
      requireApprovalForHighRiskTools: input.config.mcp.requireApprovalForHighRiskTools,
    });

    if (!decision.allowed) {
      return ['## MCP Request Rejected', decision.reason].join('\n');
    }

    if (decision.requiresApproval) {
      return [
        '## MCP Request Requires Approval',
        decision.reason,
        '',
        'Approval UI is not implemented for this tool yet.',
      ].join('\n');
    }

    try {
      const rawText = await this.broker.call({ preset, route, cwd: input.task.cwd });

      const compressed = this.compressor.compress({
        rawText,
        maxChars: input.config.mcp.maxResultChars,
        sourceLabel: `${preset.displayName} / ${route.toolName}`,
      });

      return compressed.compactText;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return ['## MCP Error', `MCP call failed: ${message}`].join('\n');
    }
  }
}
