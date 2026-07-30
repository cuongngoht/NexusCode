import { useT } from '../i18n';
import type { StreamingStage, Activity } from '../messages';

interface Props {
  stage: StreamingStage;
  label?: string;
  elapsed?: number;
  /** Last few raw output lines, shown as a dim live "peek" of what the CLI is printing. */
  tail?: string[];
  /** Per-tool activity chips not attached to a running pipeline step. */
  activities?: Activity[];
  /** Value of `elapsed` at the last output — used to detect a quiet phase for the heartbeat. */
  lastOutputElapsed?: number;
}

const STAGE_ICONS: Record<StreamingStage, string> = {
  queued: '⏳',
  planning: '🧠',
  researching: '🔍',
  reading: '📄',
  editing: '✏️',
  testing: '🧪',
  reviewing: '🔎',
  summarizing: '📝',
  completed: '✓',
  failed: '✗',
  stopped: '⏹',
};

const ACTIVITY_KIND_ICONS: Record<string, string> = {
  read: '📄', edit: '✏️', bash: '⚡', write: '📝', todo: '☑', search: '🔍', tool_call: '⚙',
};

const ACTIVE_STAGES = new Set<StreamingStage>([
  'queued', 'planning', 'researching', 'reading',
  'editing', 'testing', 'reviewing', 'summarizing',
]);

// Show the "still working…" heartbeat once output has been quiet for this many seconds.
const HEARTBEAT_AFTER = 3;

export function StreamingStatusBar({ stage, label, elapsed, tail, activities, lastOutputElapsed }: Props) {
  const t = useT();
  const isActive = ACTIVE_STAGES.has(stage);
  const streaming = t.streaming as Record<string, string>;
  const stageName = streaming[stage] ?? stage;

  const sinceOutput = elapsed != null ? elapsed - (lastOutputElapsed ?? 0) : 0;
  const showHeartbeat = isActive && sinceOutput >= HEARTBEAT_AFTER;
  const heartbeatPhrases = [streaming.stillWorking, streaming.thinking, streaming.waitingForOutput].filter(Boolean);
  const heartbeat = showHeartbeat && heartbeatPhrases.length > 0
    ? heartbeatPhrases[Math.floor((elapsed ?? 0) / HEARTBEAT_AFTER) % heartbeatPhrases.length]
    : undefined;

  return (
    <div className="nx-streaming" aria-live="polite">
      <div className={`nx-streaming-bar nx-streaming-bar--${stage}`}>
        {isActive && <span className="nx-streaming-spinner" aria-hidden="true" />}
        <span className="nx-streaming-icon" aria-hidden="true">{STAGE_ICONS[stage]}</span>
        <span className="nx-streaming-label">{label || stageName}</span>
        {heartbeat && <span className="nx-streaming-heartbeat">· {heartbeat}</span>}
        {elapsed != null && elapsed > 0 && (
          <span className="nx-streaming-elapsed">{elapsed}s</span>
        )}
      </div>

      {activities && activities.length > 0 && (
        <div className="nx-streaming-activities">
          {activities.map((act, j) => (
            <div key={j} className={`nx-streaming-activity nx-streaming-activity--${act.status}`}>
              {act.status === 'running'
                ? <span className="fl-spinner nx-activity-spinner" aria-hidden="true" />
                : <span className="nx-streaming-activity-status" aria-hidden="true">{act.status === 'done' ? '✓' : '✗'}</span>}
              <span className="nx-streaming-activity-kind" aria-hidden="true">{ACTIVITY_KIND_ICONS[act.kind] ?? '⚙'}</span>
              <span className="nx-streaming-activity-label">{act.label}</span>
            </div>
          ))}
        </div>
      )}

      {isActive && tail && tail.length > 0 && (
        <pre
          className="nx-streaming-tail"
          aria-label={streaming.liveOutput ?? 'Live output'}
        >
          {tail.join('\n')}
        </pre>
      )}
    </div>
  );
}
