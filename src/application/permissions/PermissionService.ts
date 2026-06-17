import type { PermissionRequest, PermissionResolution, AutoApproveRule } from './PermissionTypes';
import { PermissionStore } from './PermissionStore';
import { DEFAULT_PERMISSION_POLICY, type PermissionPolicyConfig } from './PermissionPolicy';

type PostFn = (msg: unknown) => void;

export class PermissionService {
  private readonly store = new PermissionStore();
  private readonly pendingPromises = new Map<
    string,
    { resolve: (r: PermissionResolution) => void; reject: (e: Error) => void }
  >();
  private readonly autoApproveRules: AutoApproveRule[] = [];
  private policy: PermissionPolicyConfig = DEFAULT_PERMISSION_POLICY;
  private post: PostFn;

  constructor(post: PostFn, policy?: Partial<PermissionPolicyConfig>) {
    this.post = post;
    if (policy) {
      this.policy = { ...DEFAULT_PERMISSION_POLICY, ...policy };
    }
  }

  setPost(post: PostFn): void {
    this.post = post;
  }

  updatePolicy(policy: Partial<PermissionPolicyConfig>): void {
    this.policy = { ...this.policy, ...policy };
  }

  async request(request: PermissionRequest): Promise<PermissionResolution> {
    // Blocked actions never execute
    if (request.risk === 'blocked') {
      const resolution: PermissionResolution = {
        requestId: request.id,
        decision: 'blocked',
        reason: 'Action blocked by policy',
        resolvedAt: Date.now(),
      };
      this.store.addResolved(resolution);
      this.post({ type: 'permissionResolved', requestId: request.id, decision: 'blocked' });
      return resolution;
    }

    // Check auto-approve rules
    const autoRule = this.findAutoApproveRule(request);
    if (autoRule) {
      const resolution: PermissionResolution = {
        requestId: request.id,
        decision: 'auto_approved',
        reason: `Auto-approved for ${autoRule.scope} scope`,
        resolvedAt: Date.now(),
      };
      this.store.addResolved(resolution);
      this.post({ type: 'permissionResolved', requestId: request.id, decision: 'auto_approved' });
      return resolution;
    }

    // Store pending and post to UI
    this.store.addPending(request);
    this.post({ type: 'permissionRequested', request });

    // Return a Promise that resolves when user approves/rejects
    return new Promise<PermissionResolution>((resolve, reject) => {
      this.pendingPromises.set(request.id, { resolve, reject });
    });
  }

  approve(requestId: string): void {
    const req = this.store.removePending(requestId);
    const handlers = this.pendingPromises.get(requestId);
    this.pendingPromises.delete(requestId);

    const resolution: PermissionResolution = {
      requestId,
      decision: 'approved',
      resolvedAt: Date.now(),
    };

    if (req) {
      this.store.addResolved(resolution);
    }

    this.post({ type: 'permissionResolved', requestId, decision: 'approved' });
    handlers?.resolve(resolution);
  }

  reject(requestId: string, reason?: string): void {
    const req = this.store.removePending(requestId);
    const handlers = this.pendingPromises.get(requestId);
    this.pendingPromises.delete(requestId);

    const resolution: PermissionResolution = {
      requestId,
      decision: 'rejected',
      reason,
      resolvedAt: Date.now(),
    };

    if (req) {
      this.store.addResolved(resolution);
    }

    this.post({ type: 'permissionResolved', requestId, decision: 'rejected' });
    handlers?.resolve(resolution);
  }

  autoApprove(requestId: string, scope: 'session' | 'workspace'): void {
    const req = this.store.getPending(requestId);
    if (!req) {
      this.approve(requestId);
      return;
    }

    // Don't auto approve high risk or blocked
    if (req.risk === 'high' || req.risk === 'blocked') {
      this.approve(requestId);
      return;
    }

    // Register rule for future requests
    const rule: AutoApproveRule = {
      scope,
      sessionId: scope === 'session' ? req.sessionId : undefined,
      subjectType: req.subjectType,
      subjectId: req.subjectId,
      actionType: req.actionType,
      maxRisk: req.risk as 'low' | 'medium',
      createdAt: Date.now(),
    };
    this.autoApproveRules.push(rule);

    // Resolve current request as auto_approved
    this.store.removePending(requestId);
    const handlers = this.pendingPromises.get(requestId);
    this.pendingPromises.delete(requestId);

    const resolution: PermissionResolution = {
      requestId,
      decision: 'auto_approved',
      reason: `Auto-approved for ${scope} scope`,
      resolvedAt: Date.now(),
    };
    this.store.addResolved(resolution);
    this.post({ type: 'permissionResolved', requestId, decision: 'auto_approved' });
    handlers?.resolve(resolution);
  }

  getPendingRequests(): PermissionRequest[] {
    return this.store.getAllPending();
  }

  clearSession(sessionId: string): void {
    const removed = this.store.clearBySession(sessionId);
    for (const req of removed) {
      const handlers = this.pendingPromises.get(req.id);
      this.pendingPromises.delete(req.id);
      const resolution: PermissionResolution = {
        requestId: req.id,
        decision: 'expired',
        reason: 'Session ended',
        resolvedAt: Date.now(),
      };
      this.post({ type: 'permissionRequestExpired', requestId: req.id });
      handlers?.resolve(resolution);
    }
    // Clear session-scoped auto-approve rules
    const idx = this.autoApproveRules.findIndex(r => r.scope === 'session' && r.sessionId === sessionId);
    if (idx !== -1) {
      this.autoApproveRules.splice(idx, 1);
    }
  }

  expireAll(): void {
    const all = this.store.expireAll();
    for (const req of all) {
      const handlers = this.pendingPromises.get(req.id);
      this.pendingPromises.delete(req.id);
      const resolution: PermissionResolution = {
        requestId: req.id,
        decision: 'expired',
        reason: 'Extension reloaded',
        resolvedAt: Date.now(),
      };
      this.post({ type: 'permissionRequestExpired', requestId: req.id });
      handlers?.resolve(resolution);
    }
  }

  replayPending(): void {
    for (const req of this.store.getAllPending()) {
      this.post({ type: 'permissionRequested', request: req });
    }
  }

  private findAutoApproveRule(request: PermissionRequest): AutoApproveRule | undefined {
    if (!this.policy.allowAutoApproveSession) return undefined;
    if (request.risk === 'high' || request.risk === 'blocked') return undefined;

    return this.autoApproveRules.find(rule => {
      if (rule.subjectType !== request.subjectType) return false;
      if (rule.subjectId !== request.subjectId) return false;
      if (rule.actionType !== request.actionType) return false;
      if (rule.scope === 'session' && rule.sessionId !== request.sessionId) return false;
      const riskOrder: Record<string, number> = { low: 0, medium: 1, high: 2, blocked: 3 };
      return (riskOrder[request.risk] ?? 1) <= (riskOrder[rule.maxRisk] ?? 1);
    });
  }
}
