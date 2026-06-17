import * as fs from 'fs';
import * as path from 'path';
import type { AgentSession, AgentSessionStatus } from './AgentSession';
import type { AgentStep } from './AgentStep';

export interface CreateAgentSessionInput {
  workspaceRoot: string;
  originalPrompt: string;
  providerId: string;
  model?: string;
  baseBranch?: string;
  workingBranch?: string;
}

export interface PersistedAgentSession {
  schemaVersion: 1;
  session: AgentSession;
}

export type AgentSessionStoreFactory = (workspaceRoot: string) => AgentSessionStore;

export class AgentSessionStore {
  private readonly sessionsDir: string;

  constructor(workspaceRoot: string) {
    this.sessionsDir = path.join(workspaceRoot, '.nexus', 'sessions');
  }

  create(input: CreateAgentSessionInput): AgentSession {
    this.ensureDir();
    const now = Date.now();
    const id = `session_${now}_${Math.random().toString(36).slice(2, 7)}`;
    const session: AgentSession = {
      id,
      workspaceRoot: input.workspaceRoot,
      originalPrompt: input.originalPrompt,
      mode: 'agent',
      status: 'created',
      providerId: input.providerId,
      model: input.model,
      baseBranch: input.baseBranch,
      workingBranch: input.workingBranch,
      checkpointIds: [],
      steps: [],
      createdAt: now,
      updatedAt: now,
    };
    this.writeSession(session);
    return session;
  }

  get(sessionId: string): AgentSession | undefined {
    const filePath = this.getSessionFilePath(sessionId);
    return this.readSession(filePath)?.session;
  }

  list(): AgentSession[] {
    if (!fs.existsSync(this.sessionsDir)) return [];
    const sessions: AgentSession[] = [];
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(this.sessionsDir, { withFileTypes: true });
    } catch {
      return [];
    }
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json') || entry.name.endsWith('.timeline.jsonl')) continue;
      const filePath = path.join(this.sessionsDir, entry.name);
      const persisted = this.readSession(filePath);
      if (persisted) {
        sessions.push(persisted.session);
      }
    }
    return sessions.sort((a, b) => b.createdAt - a.createdAt);
  }

  update(session: AgentSession): void {
    const existing = this.get(session.id);
    const updated: AgentSession = {
      ...session,
      updatedAt: Date.now(),
      // Preserve steps from existing if not overridden
      steps: session.steps.length > 0 ? session.steps : (existing?.steps ?? []),
      checkpointIds: session.checkpointIds,
    };
    this.writeSession(updated);
  }

  appendStep(sessionId: string, step: AgentStep): void {
    const session = this.get(sessionId);
    if (!session) return;
    session.steps.push(step);
    session.updatedAt = Date.now();
    this.writeSession(session);
  }

  updateStep(sessionId: string, step: AgentStep): void {
    const session = this.get(sessionId);
    if (!session) return;
    const idx = session.steps.findIndex(s => s.id === step.id);
    if (idx >= 0) {
      session.steps[idx] = step;
    } else {
      session.steps.push(step);
    }
    session.updatedAt = Date.now();
    this.writeSession(session);
  }

  markStatus(sessionId: string, status: AgentSessionStatus): void {
    const session = this.get(sessionId);
    if (!session) return;
    session.status = status;
    session.updatedAt = Date.now();
    this.writeSession(session);
  }

  markCompleted(sessionId: string): void {
    this.markStatus(sessionId, 'completed');
  }

  markFailed(sessionId: string, error: string): void {
    const session = this.get(sessionId);
    if (!session) return;
    session.status = 'failed';
    session.error = error;
    session.updatedAt = Date.now();
    this.writeSession(session);
  }

  markCancelled(sessionId: string, reason?: string): void {
    const session = this.get(sessionId);
    if (!session) return;
    session.status = 'cancelled';
    session.rejectReason = reason;
    session.updatedAt = Date.now();
    this.writeSession(session);
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  private getSessionFilePath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}.json`);
  }

  private readSession(filePath: string): PersistedAgentSession | undefined {
    if (!fs.existsSync(filePath)) return undefined;
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(content) as PersistedAgentSession;
      if (parsed.schemaVersion !== 1 || !parsed.session?.id) return undefined;
      return parsed;
    } catch {
      return undefined;
    }
  }

  private writeSession(session: AgentSession): void {
    this.ensureDir();
    const filePath = this.getSessionFilePath(session.id);
    const tmpPath = filePath + '.tmp';
    const persisted: PersistedAgentSession = { schemaVersion: 1, session };
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(persisted, null, 2), 'utf8');
      fs.renameSync(tmpPath, filePath);
    } catch (err) {
      // Clean up tmp file on error
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
      throw err;
    }
  }
}
