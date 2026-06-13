import { useStreamStore, type TimelineStep } from '../streamStore';
import { useT } from '../i18n';

const STATUS_ICONS = {
  running: '⟳',
  done: '✓',
  error: '✖',
} as const;

interface ToolChipProps {
  name: string;
  kind?: string;
  status: 'running' | 'done' | 'error';
}

function ToolChip({ name, status }: ToolChipProps) {
  return (
    <span className={`nx-step-timeline__tool nx-step-timeline__tool--${status}`}>
      <span className="nx-step-timeline__tool-icon" aria-hidden="true">
        {STATUS_ICONS[status]}
      </span>
      <span className="nx-step-timeline__tool-name">{name}</span>
    </span>
  );
}

interface StepRowProps {
  step: TimelineStep;
}

function StepRow({ step }: StepRowProps) {
  const t = useT();
  const statusLabel =
    step.status === 'running'
      ? t.stepTimeline.stepRunning
      : step.status === 'done'
        ? t.stepTimeline.stepDone
        : t.stepTimeline.stepError;

  return (
    <li className={`nx-step-timeline__step nx-step-timeline__step--${step.status}`}>
      <span
        className="nx-step-timeline__step-icon"
        aria-hidden="true"
        title={statusLabel}
      >
        {STATUS_ICONS[step.status]}
      </span>
      <span className="nx-step-timeline__step-label">{step.label}</span>
      {step.tools.length > 0 && (
        <span className="nx-step-timeline__tools">
          {step.tools.map((tool, i) => (
            <ToolChip key={`${tool.name}-${i}`} name={tool.name} kind={tool.kind} status={tool.status} />
          ))}
        </span>
      )}
    </li>
  );
}

export function StepTimeline() {
  const { steps } = useStreamStore();
  const t = useT();

  if (steps.length === 0) return null;

  return (
    <ol
      className="nx-step-timeline"
      aria-label={t.stepTimeline.ariaLabel}
    >
      {steps.map((step, i) => (
        <StepRow key={`${step.label}-${i}`} step={step} />
      ))}
    </ol>
  );
}
