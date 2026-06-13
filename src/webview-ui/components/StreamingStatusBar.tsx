import { useT } from '../i18n';
import type { StreamingStage } from '../messages';

interface Props {
  stage: StreamingStage;
  label?: string;
  elapsed?: number;
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

const ACTIVE_STAGES = new Set<StreamingStage>([
  'queued', 'planning', 'researching', 'reading',
  'editing', 'testing', 'reviewing', 'summarizing',
]);

export function StreamingStatusBar({ stage, label, elapsed }: Props) {
  const t = useT();
  const isActive = ACTIVE_STAGES.has(stage);
  const stageName = (t.streaming as Record<string, string>)[stage] ?? stage;

  return (
    <div className={`nx-streaming-bar nx-streaming-bar--${stage}`} aria-live="polite">
      {isActive && <span className="nx-streaming-spinner" aria-hidden="true" />}
      <span className="nx-streaming-icon" aria-hidden="true">{STAGE_ICONS[stage]}</span>
      <span className="nx-streaming-label">{label || stageName}</span>
      {elapsed != null && elapsed > 0 && (
        <span className="nx-streaming-elapsed">{elapsed}s</span>
      )}
    </div>
  );
}
