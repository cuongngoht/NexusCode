/**
 * In-process "one in flight + one pending" coalescing guard, keyed by workspaceRoot.
 *
 * ArchitectureMemoryWriter writes architecture.json/architecture.md/dependency-graph.json/
 * violations.json as four independent tmp+rename operations with no cross-file transaction.
 * Two concurrent refreshes for the same workspace could interleave those writes and leave the
 * four files mutually inconsistent. This gate ensures only one refresh task is ever in flight
 * per workspaceRoot; overlapping requests are coalesced rather than interleaved.
 *
 * There is no cross-process lock here by design — the VS Code extension host is single-process
 * per workspace window, so only concurrent async calls within that process need guarding.
 */
export type GateResult<T> = T | { kind: 'coalesced' };

export class ArchitectureRefreshGate {
  private readonly inFlight = new Map<string, Promise<unknown>>();

  async run<T>(workspaceRoot: string, task: () => Promise<T>): Promise<GateResult<T>> {
    if (this.inFlight.has(workspaceRoot)) {
      return { kind: 'coalesced' };
    }

    const promise = task().finally(() => {
      this.inFlight.delete(workspaceRoot);
    });
    this.inFlight.set(workspaceRoot, promise);
    return promise as Promise<T>;
  }
}
