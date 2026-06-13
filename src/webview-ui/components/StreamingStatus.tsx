import { useStreamStore } from '../streamStore';
import { useT, interp } from '../i18n';

export function StreamingStatus() {
  const { phase, isRunning, isComplete, hasFailed } = useStreamStore();
  const t = useT();

  if (!isRunning && !isComplete && !hasFailed) return null;

  let statusLabel: string;
  let statusClass: string;

  if (isRunning) {
    statusLabel = phase
      ? interp(t.streamStatus.phase, { phase })
      : t.streamStatus.running;
    statusClass = 'nx-stream-status--running';
  } else if (hasFailed) {
    statusLabel = t.streamStatus.failed;
    statusClass = 'nx-stream-status--failed';
  } else {
    statusLabel = t.streamStatus.complete;
    statusClass = 'nx-stream-status--complete';
  }

  return (
    <div className={`nx-stream-status ${statusClass}`} aria-live="polite">
      {isRunning && <span className="nx-stream-status__spinner" aria-hidden="true" />}
      <span className="nx-stream-status__label">{statusLabel}</span>
    </div>
  );
}
