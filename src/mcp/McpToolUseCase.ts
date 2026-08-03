import type { NexusConfig } from '../config/NexusConfig';
import type { AgentTask } from '../core/agent';
import type { IMcpApprovalGate } from './McpApprovalGate';
import { buildCustomPresets, isCustomPresetId, pickToolNameForIntent } from './McpCustomServers';
import type { McpPreset, McpRoute, McpToolDescriptor, McpToolIntent } from './McpTypes';
import type { IMcpBroker } from './McpBroker';
import type { IMcpExecutionPolicy } from './McpExecutionPolicy';
import type { IMcpIntentParser } from './McpIntentParser';
import type { IMcpPresetRegistry } from './McpPresetRegistry';
import type { IMcpPresetSelectionPolicy } from './McpPresetSelectionPolicy';
import type { IMcpResultCompressor } from './McpResultCompressor';
import type { IMcpToolRouter } from './McpToolRouter';

export class McpToolUseCase {
  private approvalGate?: IMcpApprovalGate;

  constructor(
    private readonly registry: IMcpPresetRegistry,
    private readonly selector: IMcpPresetSelectionPolicy,
    private readonly router: IMcpToolRouter,
    private readonly parser: IMcpIntentParser,
    private readonly policy: IMcpExecutionPolicy,
    private readonly broker: IMcpBroker,
    private readonly compressor: IMcpResultCompressor,
  ) {}

  // Setter injection: the use case is built in extension.ts before any
  // webview (and thus PermissionService) exists; the active ChatController
  // attaches the gate when it is created.
  setApprovalGate(gate: IMcpApprovalGate): void {
    this.approvalGate = gate;
  }

  async tryHandleToolIntent(input: {
    task: AgentTask;
    output: string;
    config: NexusConfig;
  }): Promise<string | undefined> {
    const intent = this.parser.parse(input.output);
    if (!intent) return undefined;

    const builtinPresets = this.registry.getAll().filter(preset => {
      if (preset.id === 'microsoftLearn') {
        return input.config.mcp.presets.microsoftLearn.enabled;
      }
      if (preset.id === 'context7') {
        return input.config.mcp.presets.context7.enabled;
      }
      return false;
    });

    const customPresets = buildCustomPresets(input.config.mcp.customServers)
      .filter(entry => entry.enabled)
      .map(entry => entry.preset);

    const enabledPresets = [...builtinPresets, ...customPresets];

    const preset = this.selector.select({
      prompt: input.task.prompt,
      mode: input.task.mode,
      intent,
      enabledPresets,
    });

    if (!preset) {
      return ['## MCP Request Rejected', 'No enabled MCP preset can satisfy this request.'].join('\n');
    }

    let route = this.router.route(intent, preset);

    // Custom servers without a pinned defaultTool: discover tools/list and
    // pick one BEFORE the execution policy runs (it rejects empty tool names).
    if (!route.toolName && isCustomPresetId(preset.id)) {
      try {
        route = await this.resolveCustomRoute({
          preset,
          route,
          intent,
          cwd: input.task.cwd,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return ['## MCP Error', `Tool discovery failed for ${preset.displayName}: ${message}`].join('\n');
      }
    }

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
      if (!this.approvalGate) {
        return [
          '## MCP Request Denied',
          decision.reason,
          '',
          'This tool requires approval, but no approval UI is attached. The tool was not executed.',
        ].join('\n');
      }

      const outcome = await this.approvalGate.requestApproval(
        {
          presetId: preset.id,
          presetDisplayName: preset.displayName,
          toolName: route.toolName,
          arguments: route.arguments,
          reason: decision.reason,
          cwd: input.task.cwd,
        },
        input.config.mcp.approvalTimeoutMs,
      );

      if (outcome !== 'approved') {
        const detail = outcome === 'timeout'
          ? 'The approval request timed out.'
          : 'The user denied the request.';
        return [
          '## MCP Request Denied',
          decision.reason,
          '',
          `${detail} The tool was not executed.`,
        ].join('\n');
      }
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

  private async resolveCustomRoute(input: {
    preset: McpPreset;
    route: McpRoute;
    intent: McpToolIntent;
    cwd?: string;
  }): Promise<McpRoute> {
    const tools = await this.broker.listTools({ preset: input.preset, cwd: input.cwd });
    if (tools.length === 0) {
      throw new Error('The server advertises no tools.');
    }

    const toolName = pickToolNameForIntent(tools, input.intent) ?? tools[0].name;
    const tool = tools.find(t => t.name === toolName) ?? tools[0];

    return {
      ...input.route,
      toolName: tool.name,
      arguments: this.buildArgumentsForTool(tool, input.intent),
    };
  }

  /**
   * Custom servers do not necessarily accept `{ query }` — map the intent
   * query onto the tool's actual input schema when possible.
   */
  private buildArgumentsForTool(
    tool: McpToolDescriptor,
    intent: McpToolIntent,
  ): Record<string, unknown> {
    const properties = tool.inputSchema?.properties;
    if (!properties || typeof properties !== 'object') {
      return { query: intent.query };
    }

    const names = Object.keys(properties);
    if (names.includes('query')) return { query: intent.query };

    // Prefer the first required property, otherwise the first declared one.
    const required = tool.inputSchema?.required?.filter(name => names.includes(name)) ?? [];
    const target = required[0] ?? names[0];
    return target ? { [target]: intent.query } : { query: intent.query };
  }
}
