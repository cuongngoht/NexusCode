import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PermissionMcpApprovalGate } from './PermissionMcpApprovalGate';
import { PermissionService } from './PermissionService';
import type { McpApprovalRequest } from '../../mcp/McpApprovalGate';

const approvalRequest: McpApprovalRequest = {
  presetId: 'context7',
  presetDisplayName: 'Context7',
  toolName: 'query-docs',
  arguments: { query: 'react hooks' },
  reason: 'High-risk tool requires approval.',
  cwd: '/ws',
};

describe('PermissionMcpApprovalGate', () => {
  let posted: Array<Record<string, unknown>>;
  let service: PermissionService;
  let gate: PermissionMcpApprovalGate;

  beforeEach(() => {
    vi.useFakeTimers();
    posted = [];
    service = new PermissionService(msg => posted.push(msg as Record<string, unknown>));
    gate = new PermissionMcpApprovalGate(service);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function pendingRequestId(): string {
    const requested = posted.find(m => m['type'] === 'permissionRequested') as { request: { id: string } };
    return requested.request.id;
  }

  it('posts a high-risk mcp permission request and resolves approved on user approval', async () => {
    const outcome = gate.requestApproval(approvalRequest, 60_000);
    await Promise.resolve();

    const requested = posted.find(m => m['type'] === 'permissionRequested') as {
      request: Record<string, unknown>;
    };
    expect(requested.request['subjectType']).toBe('mcp');
    expect(requested.request['actionType']).toBe('mcp.tool.run');
    expect(requested.request['risk']).toBe('high');
    expect(requested.request['command']).toBe('query-docs');

    service.approve(pendingRequestId());
    await expect(outcome).resolves.toBe('approved');
  });

  it('resolves denied when the user rejects', async () => {
    const outcome = gate.requestApproval(approvalRequest, 60_000);
    await Promise.resolve();
    service.reject(pendingRequestId(), 'no thanks');
    await expect(outcome).resolves.toBe('denied');
  });

  it('rejects the pending request and resolves timeout when the timer expires', async () => {
    const outcome = gate.requestApproval(approvalRequest, 60_000);
    await Promise.resolve();
    const id = pendingRequestId();

    vi.advanceTimersByTime(60_000);
    await expect(outcome).resolves.toBe('timeout');

    // The card is cleared from the UI via permissionResolved
    const resolved = posted.find(
      m => m['type'] === 'permissionResolved' && m['requestId'] === id,
    ) as { decision: string };
    expect(resolved.decision).toBe('rejected');
    expect(service.getPendingRequests()).toHaveLength(0);
  });

  it('treats auto_approved as approved', async () => {
    // Approving high-risk requests never auto-approves, so exercise the
    // decision mapping through autoApprove on the pending request directly.
    const outcome = gate.requestApproval(approvalRequest, 60_000);
    await Promise.resolve();
    service.autoApprove(pendingRequestId(), 'session');
    await expect(outcome).resolves.toBe('approved');
  });
});
