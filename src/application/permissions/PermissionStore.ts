import type { PermissionRequest, PermissionResolution } from './PermissionTypes';

export class PermissionStore {
  private readonly pending = new Map<string, PermissionRequest>();
  private readonly resolved = new Map<string, PermissionResolution>();

  addPending(request: PermissionRequest): void {
    this.pending.set(request.id, request);
  }

  removePending(requestId: string): PermissionRequest | undefined {
    const req = this.pending.get(requestId);
    this.pending.delete(requestId);
    return req;
  }

  getPending(requestId: string): PermissionRequest | undefined {
    return this.pending.get(requestId);
  }

  getAllPending(): PermissionRequest[] {
    return Array.from(this.pending.values());
  }

  getPendingBySession(sessionId: string): PermissionRequest[] {
    return Array.from(this.pending.values()).filter(r => r.sessionId === sessionId);
  }

  addResolved(resolution: PermissionResolution): void {
    this.resolved.set(resolution.requestId, resolution);
  }

  getResolved(requestId: string): PermissionResolution | undefined {
    return this.resolved.get(requestId);
  }

  clearBySession(sessionId: string): PermissionRequest[] {
    const removed: PermissionRequest[] = [];
    for (const [id, req] of this.pending) {
      if (req.sessionId === sessionId) {
        this.pending.delete(id);
        removed.push(req);
      }
    }
    return removed;
  }

  expireAll(): PermissionRequest[] {
    const all = Array.from(this.pending.values());
    this.pending.clear();
    return all;
  }
}
