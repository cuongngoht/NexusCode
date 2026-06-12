import type { Memento } from 'vscode';
import type { ArtifactRef } from './ArtifactTypes';

const STORE_KEY = 'nexus.artifacts.v1';
const MAX_ARTIFACTS = 200;

export class ArtifactStore {
  constructor(private readonly state: Memento) {}

  load(): ArtifactRef[] {
    try {
      return this.state.get<ArtifactRef[]>(STORE_KEY, []);
    } catch {
      return [];
    }
  }

  async save(artifacts: ArtifactRef[]): Promise<void> {
    const trimmed = artifacts
      .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
      .slice(0, MAX_ARTIFACTS);
    await this.state.update(STORE_KEY, trimmed);
  }

  async add(artifact: ArtifactRef): Promise<void> {
    const existing = this.load();
    const idx = existing.findIndex(a => a.id === artifact.id);
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...artifact, updatedAt: Date.now() };
    } else {
      existing.unshift(artifact);
    }
    await this.save(existing);
  }

  async remove(id: string): Promise<void> {
    const existing = this.load().filter(a => a.id !== id);
    await this.save(existing);
  }

  async clear(): Promise<void> {
    await this.state.update(STORE_KEY, []);
  }

  byConversation(conversationId: string): ArtifactRef[] {
    return this.load().filter(a => a.sourceConversationId === conversationId);
  }

  byTask(taskId: string): ArtifactRef[] {
    return this.load().filter(a => a.sourceTaskId === taskId);
  }
}
