import { describe, it, expect } from 'vitest';
import { McpExecutionPolicy } from './McpExecutionPolicy';
import type { McpPreset, McpRoute } from './McpTypes';

const policy = new McpExecutionPolicy();

const lowRiskPreset: McpPreset = {
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
  risk: 'low',
};

const highRiskPreset: McpPreset = {
  ...lowRiskPreset,
  risk: 'high',
};

const validRoute: McpRoute = {
  presetId: 'context7',
  toolName: 'query-docs',
  arguments: { query: 'react hooks' },
  reason: 'need docs',
};

const routeNoToolName: McpRoute = {
  presetId: 'context7',
  toolName: '',
  arguments: { query: 'react hooks' },
  reason: 'need docs',
};

describe('McpExecutionPolicy', () => {
  it('rejects when MCP is disabled', () => {
    const result = policy.evaluate({
      mode: 'ask',
      preset: lowRiskPreset,
      route: validRoute,
      mcpEnabled: false,
      requireApprovalForHighRiskTools: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/disabled/i);
  });

  it('allows low-risk tools when enabled', () => {
    const result = policy.evaluate({
      mode: 'ask',
      preset: lowRiskPreset,
      route: validRoute,
      mcpEnabled: true,
      requireApprovalForHighRiskTools: true,
    });
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(false);
  });

  it('requires approval for high-risk tools when requireApproval is true', () => {
    const result = policy.evaluate({
      mode: 'ask',
      preset: highRiskPreset,
      route: validRoute,
      mcpEnabled: true,
      requireApprovalForHighRiskTools: true,
    });
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(true);
  });

  it('does not require approval for high-risk tools when requireApproval is false', () => {
    const result = policy.evaluate({
      mode: 'ask',
      preset: highRiskPreset,
      route: validRoute,
      mcpEnabled: true,
      requireApprovalForHighRiskTools: false,
    });
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(false);
  });

  it('rejects when tool name is missing', () => {
    const result = policy.evaluate({
      mode: 'ask',
      preset: lowRiskPreset,
      route: routeNoToolName,
      mcpEnabled: true,
      requireApprovalForHighRiskTools: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/missing/i);
  });
});
