import { describe, it, expect, vi } from 'vitest';
import { McpToolUseCase } from './McpToolUseCase';
import { AgentTask } from '../core/agent';
import { DEFAULT_CONFIG } from '../config/DefaultConfig';
import type { NexusConfig } from '../config/NexusConfig';
import type { McpPreset, McpRoute, McpToolIntent } from './McpTypes';
import type { IMcpApprovalGate, McpApprovalOutcome } from './McpApprovalGate';

const preset: McpPreset = {
  id: 'context7',
  displayName: 'Context7',
  description: 'Library docs',
  transport: 'stdio',
  command: 'npx',
  args: [],
  priority: 85,
  enabledByDefault: true,
  bestFor: [],
  toolGroups: ['docs'],
  risk: 'high',
};

const route: McpRoute = {
  presetId: 'context7',
  toolName: 'query-docs',
  arguments: { query: 'react hooks' },
  reason: 'need docs',
};

const intent: McpToolIntent = { group: 'docs', query: 'react hooks', reason: 'need docs' } as McpToolIntent;

function makeConfig(): NexusConfig {
  const config = structuredClone(DEFAULT_CONFIG);
  config.mcp.enabled = true;
  config.mcp.approvalTimeoutMs = 50;
  return config;
}

function makeUseCase(options: {
  requiresApproval: boolean;
  gateOutcome?: McpApprovalOutcome;
}) {
  const brokerCall = vi.fn().mockResolvedValue('raw result');
  const useCase = new McpToolUseCase(
    { getAll: () => [preset] },
    { select: () => preset },
    { route: () => route },
    { parse: () => intent },
    {
      evaluate: () => ({
        allowed: true,
        requiresApproval: options.requiresApproval,
        reason: 'High-risk tool requires approval.',
      }),
    },
    { call: brokerCall },
    { compress: (input: { rawText: string }) => ({ compactText: input.rawText, truncated: false }) },
  );

  let gateCalls = 0;
  if (options.gateOutcome) {
    const gate: IMcpApprovalGate = {
      requestApproval: async () => {
        gateCalls += 1;
        return options.gateOutcome!;
      },
    };
    useCase.setApprovalGate(gate);
  }

  return { useCase, brokerCall, getGateCalls: () => gateCalls };
}

function makeTask(): AgentTask {
  return new AgentTask('find docs', 'find docs', 'claude', 'ask', undefined, '/ws');
}

describe('McpToolUseCase approval flow', () => {
  it('denies without executing when approval is required but no gate is attached', async () => {
    const { useCase, brokerCall } = makeUseCase({ requiresApproval: true });
    const result = await useCase.tryHandleToolIntent({ task: makeTask(), output: 'x', config: makeConfig() });
    expect(result).toContain('## MCP Request Denied');
    expect(result).toContain('no approval UI is attached');
    expect(brokerCall).not.toHaveBeenCalled();
  });

  it('executes the tool when the gate approves', async () => {
    const { useCase, brokerCall, getGateCalls } = makeUseCase({ requiresApproval: true, gateOutcome: 'approved' });
    const result = await useCase.tryHandleToolIntent({ task: makeTask(), output: 'x', config: makeConfig() });
    expect(getGateCalls()).toBe(1);
    expect(brokerCall).toHaveBeenCalledOnce();
    expect(result).toBe('raw result');
  });

  it('denies without executing when the gate reports denial', async () => {
    const { useCase, brokerCall } = makeUseCase({ requiresApproval: true, gateOutcome: 'denied' });
    const result = await useCase.tryHandleToolIntent({ task: makeTask(), output: 'x', config: makeConfig() });
    expect(result).toContain('## MCP Request Denied');
    expect(result).toContain('denied the request');
    expect(brokerCall).not.toHaveBeenCalled();
  });

  it('denies without executing when the gate times out', async () => {
    const { useCase, brokerCall } = makeUseCase({ requiresApproval: true, gateOutcome: 'timeout' });
    const result = await useCase.tryHandleToolIntent({ task: makeTask(), output: 'x', config: makeConfig() });
    expect(result).toContain('## MCP Request Denied');
    expect(result).toContain('timed out');
    expect(brokerCall).not.toHaveBeenCalled();
  });

  it('skips the gate entirely when approval is not required', async () => {
    const { useCase, brokerCall, getGateCalls } = makeUseCase({ requiresApproval: false, gateOutcome: 'denied' });
    const result = await useCase.tryHandleToolIntent({ task: makeTask(), output: 'x', config: makeConfig() });
    expect(getGateCalls()).toBe(0);
    expect(brokerCall).toHaveBeenCalledOnce();
    expect(result).toBe('raw result');
  });
});
