import { describe, it, expect, vi } from 'vitest';
import { McpToolUseCase } from './McpToolUseCase';
import { AgentTask } from '../core/agent';
import { DEFAULT_CONFIG } from '../config/DefaultConfig';
import type { NexusConfig } from '../config/NexusConfig';
import type { McpPreset, McpRoute, McpToolIntent } from './McpTypes';
import type { IMcpApprovalGate, McpApprovalOutcome } from './McpApprovalGate';

// Deliberately a single-call preset: these tests are about the approval gate, so they
// must not also depend on context7's resolve-library-id → query-docs chain (covered in
// its own describe block below).
const preset: McpPreset = {
  id: 'microsoftLearn',
  displayName: 'Microsoft Learn',
  description: 'Official Microsoft docs',
  transport: 'streamableHttp',
  endpoint: 'https://learn.microsoft.com/api/mcp',
  priority: 90,
  enabledByDefault: true,
  bestFor: [],
  toolGroups: ['docs'],
  risk: 'high',
};

const route: McpRoute = {
  presetId: 'microsoftLearn',
  toolName: 'microsoft_docs_search',
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

// ---------------------------------------------------------------------------
// context7 needs two calls: resolve-library-id, then query-docs with the returned id.
// Sending only { query } produced `MCP error -32602 … libraryId … received undefined`,
// so every library-api lookup failed.
// ---------------------------------------------------------------------------

const context7Preset: McpPreset = {
  id: 'context7',
  displayName: 'Context7',
  description: 'Library docs',
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@upstash/context7-mcp'],
  priority: 85,
  enabledByDefault: true,
  bestFor: [],
  toolGroups: ['library-api'],
  risk: 'low',
};

const RESOLVE_RESPONSE = [
  'Available Libraries:',
  '',
  '- Title: React',
  '- Context7-compatible library ID: /reactjs/react.dev',
  '- Code Snippets: 6052',
].join('\n');

function makeContext7UseCase(options: {
  resolveResponse?: string;
  requiresApproval?: boolean;
  gateOutcome?: McpApprovalOutcome;
}) {
  const brokerCall = vi.fn(async ({ route: r }: { route: McpRoute }) =>
    r.toolName === 'resolve-library-id' ? (options.resolveResponse ?? RESOLVE_RESPONSE) : 'DOC BODY',
  );
  const useCase = new McpToolUseCase(
    { getAll: () => [context7Preset] },
    { select: () => context7Preset },
    { route: () => ({ presetId: 'context7', toolName: 'query-docs', arguments: { query: 'react hooks' }, reason: 'need docs' }) },
    { parse: () => intent },
    { evaluate: () => ({ allowed: true, requiresApproval: options.requiresApproval ?? false, reason: 'low risk' }) },
    { call: brokerCall },
    { compress: (input: { rawText: string }) => ({ compactText: input.rawText, truncated: false }) },
  );
  if (options.gateOutcome) {
    useCase.setApprovalGate({ requestApproval: async () => options.gateOutcome! });
  }
  return { useCase, brokerCall };
}

describe('McpToolUseCase — context7 library resolution', () => {
  it('resolves the library id, then calls query-docs with it', async () => {
    const { useCase, brokerCall } = makeContext7UseCase({});
    const outcome = await useCase.runIntent({ task: makeTask(), intent, config: makeConfig() });

    expect(brokerCall).toHaveBeenCalledTimes(2);
    expect(brokerCall.mock.calls[0][0].route).toMatchObject({
      toolName: 'resolve-library-id',
      arguments: { query: 'react hooks', libraryName: 'react' },
    });
    expect(brokerCall.mock.calls[1][0].route).toMatchObject({
      toolName: 'query-docs',
      arguments: { libraryId: '/reactjs/react.dev', query: 'react hooks' },
    });
    expect(outcome.status).toBe('executed');
    expect(outcome.contextText).toBe('DOC BODY');
  });

  it('reports an error rather than calling query-docs when nothing matched', async () => {
    const { useCase, brokerCall } = makeContext7UseCase({ resolveResponse: 'No results found.' });
    const outcome = await useCase.runIntent({ task: makeTask(), intent, config: makeConfig() });

    expect(brokerCall).toHaveBeenCalledOnce();
    expect(outcome.status).toBe('error');
    expect(outcome.contextText).toContain('No Context7 library matched');
  });

  // Resolution sends the user's query to the server, so it must never happen while the
  // request is unapproved.
  it('does not resolve before approval is granted', async () => {
    const { useCase, brokerCall } = makeContext7UseCase({ requiresApproval: true, gateOutcome: 'denied' });
    const outcome = await useCase.runIntent({ task: makeTask(), intent, config: makeConfig() });

    expect(brokerCall).not.toHaveBeenCalled();
    expect(outcome.status).toBe('denied');
  });

  it('reports the tool the user receives results from, not the resolution hop', async () => {
    const { useCase } = makeContext7UseCase({});
    const outcome = await useCase.runIntent({ task: makeTask(), intent, config: makeConfig() });
    expect(outcome.used).toEqual({
      presetId: 'context7',
      presetDisplayName: 'Context7',
      toolName: 'query-docs',
    });
  });

  // So the UI can say "Blocked: Context7" rather than just "Blocked: docs".
  it('still names the preset on a denied round', async () => {
    const { useCase } = makeContext7UseCase({ requiresApproval: true, gateOutcome: 'denied' });
    const outcome = await useCase.runIntent({ task: makeTask(), intent, config: makeConfig() });
    expect(outcome.status).toBe('denied');
    expect(outcome.used).toMatchObject({ presetDisplayName: 'Context7', toolName: 'query-docs' });
  });

  it('names the preset on a failed round too', async () => {
    const { useCase } = makeContext7UseCase({ resolveResponse: 'No results found.' });
    const outcome = await useCase.runIntent({ task: makeTask(), intent, config: makeConfig() });
    expect(outcome.status).toBe('error');
    expect(outcome.used).toMatchObject({ presetDisplayName: 'Context7' });
  });
});
