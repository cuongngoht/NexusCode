import type { IFileIntelligenceStore } from './FileIntelligenceStore';
import type { FileIntelligenceUpdater } from './FileIntelligenceUpdater';
import type { FileIntelligenceIgnoreFilter } from './FileIntelligenceIgnoreFilter';
import type { FileTouchEvent, FileIntelligenceIndex, FileIntelligenceProfile } from './types';

export class FileIntelligenceService {
  constructor(
    private readonly store: IFileIntelligenceStore,
    private readonly updater: FileIntelligenceUpdater,
    private readonly ignoreFilter: FileIntelligenceIgnoreFilter,
  ) {}

  processAsync(events: FileTouchEvent[]): void {
    this.processAll(events).catch(err => {
      console.warn('[FileIntelligenceService] processAll failed:', err instanceof Error ? err.message : String(err));
    });
  }

  async processAll(events: FileTouchEvent[]): Promise<void> {
    // Group events by workspaceRoot + filePath to batch updates
    const grouped = new Map<string, FileTouchEvent[]>();
    for (const event of events) {
      const key = `${event.workspaceRoot}\0${event.filePath}`;
      const list = grouped.get(key);
      if (list) {
        list.push(event);
      } else {
        grouped.set(key, [event]);
      }
    }

    for (const fileEvents of grouped.values()) {
      // Process events for the same file sequentially (oldest first)
      const sorted = fileEvents.slice().sort((a, b) => a.timestamp - b.timestamp);
      for (const event of sorted) {
        await this.processSingle(event);
      }
    }
  }

  async processSingle(event: FileTouchEvent): Promise<void> {
    try {
      if (this.ignoreFilter.shouldIgnore(event.filePath)) return;

      const existing = await this.store.read(event.workspaceRoot, event.filePath);
      const updated = this.updater.update(existing, event);
      await this.store.write(event.workspaceRoot, updated);
      await this.updateIndex(event.workspaceRoot, updated);
    } catch (err) {
      console.warn(
        '[FileIntelligenceService] processSingle failed for',
        event.filePath,
        ':',
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  private async updateIndex(workspaceRoot: string, profile: FileIntelligenceProfile): Promise<void> {
    const existing = await this.store.readIndex(workspaceRoot);
    const index: FileIntelligenceIndex = existing ?? { version: 1, updatedAt: 0, profiles: [] };

    const entry = {
      filePath: profile.filePath,
      freshness: profile.freshness,
      confidence: profile.confidence,
      updatedAt: profile.updatedAt,
    };

    const existingIdx = index.profiles.findIndex(p => p.filePath === profile.filePath);
    if (existingIdx === -1) {
      index.profiles.push(entry);
    } else {
      index.profiles[existingIdx] = entry;
    }

    await this.store.writeIndex(workspaceRoot, { ...index, updatedAt: Date.now() });
  }
}
