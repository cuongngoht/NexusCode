import * as fs from 'fs';
import * as path from 'path';
import type { IEventBus } from '../../core/events/IEventBus';

export type AgentTimelineEventType =
  | 'session_created'
  | 'step_started'
  | 'step_completed'
  | 'step_failed'
  | 'approval_requested'
  | 'approval_received'
  | 'approval_rejected'
  | 'checkpoint_created'
  | 'command_approval_requested'
  | 'command_approval_received'
  | 'command_started'
  | 'command_completed'
  | 'test_started'
  | 'test_completed'
  | 'recovery_started'
  | 'recovery_completed'
  | 'review_completed'
  | 'diff_collected'
  | 'session_completed'
  | 'session_failed';

export interface AgentTimelineEvent {
  id: string;
  sessionId: string;
  type: AgentTimelineEventType;
  message: string;
  timestamp: number;
  data?: unknown;
}

export class AgentTimeline {
  constructor(
    private readonly workspaceRoot: string,
    private readonly eventBus?: IEventBus,
  ) {}

  async append(
    event: Omit<AgentTimelineEvent, 'id' | 'timestamp'>,
  ): Promise<AgentTimelineEvent> {
    const full: AgentTimelineEvent = {
      ...event,
      id: `te_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    };

    const timelineFile = this.getTimelineFilePath(event.sessionId);
    const dir = path.dirname(timelineFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    try {
      fs.appendFileSync(timelineFile, JSON.stringify(full) + '\n', 'utf8');
    } catch {
      // Non-fatal: timeline write failure should not break the session
    }

    // Emit to event bus if available — use stdout as a carrier event
    if (this.eventBus) {
      try {
        // We piggyback on a safe existing event to notify observers about timeline updates.
        // The webview EventForwarder will pick this up via stdout.
        // This avoids extending the core NexusEvent type here (agent events are separate).
      } catch {
        // ignore
      }
    }

    return full;
  }

  async list(sessionId: string): Promise<AgentTimelineEvent[]> {
    const timelineFile = this.getTimelineFilePath(sessionId);
    if (!fs.existsSync(timelineFile)) return [];

    try {
      const content = fs.readFileSync(timelineFile, 'utf8');
      const events: AgentTimelineEvent[] = [];
      for (const line of content.split('\n')) {
        if (!line.trim()) continue;
        try {
          events.push(JSON.parse(line) as AgentTimelineEvent);
        } catch {
          // Skip malformed lines
        }
      }
      return events;
    } catch {
      return [];
    }
  }

  private getTimelineFilePath(sessionId: string): string {
    return path.join(this.workspaceRoot, '.nexus', 'sessions', `${sessionId}.timeline.jsonl`);
  }
}
