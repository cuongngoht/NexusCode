import { useState } from 'react';
import type { AssistantMessage as AssistantMsg, PipelineStep } from '../messages';
import { IconSparkle, IconCopy, IconThumbUp, IconThumbDown, IconRetry } from '../NexusIcons';
import { useT, interp } from '../i18n';

interface Props {
  message: AssistantMsg;
  isRunning?: boolean;
}

function StepIcon({ status }: { status: PipelineStep['status'] }) {
  if (status === 'running') {
    return <span className="fl-spinner nx-step-spinner" />;
  }
  if (status === 'done') {
    return <span className="nx-step-icon nx-step-done">✓</span>;
  }
  return <span className="nx-step-icon nx-step-error">✗</span>;
}

function PipelineSteps({ steps }: { steps: PipelineStep[] }) {
  const t = useT();
  if (steps.length === 0) { return null; }
  const stepLabels = t.pipeline.steps as Record<string, string>;
  return (
    <div className="nx-steps">
      {steps.map((step, i) => (
        <div key={i} className={`nx-step nx-step-${step.status}`}>
          <StepIcon status={step.status} />
          <span className="nx-step-label">{stepLabels[step.label] ?? step.label}</span>
        </div>
      ))}
    </div>
  );
}

function StatusPill({ message }: { message: AssistantMsg }) {
  const t = useT();
  if (message.isStreaming) {
    return (
      <span className="fl-pill fl-pill-running">
        <span className="fl-spinner" style={{ width: 10, height: 10 }} />
        {t.agent.statusRunning}
      </span>
    );
  }
  if (message.errorText) {
    return <span className="fl-pill fl-pill-error">{t.agent.statusError}</span>;
  }
  if (message.exitCode === undefined) {
    return <span className="fl-pill fl-pill-stopped">{t.agent.statusStopped}</span>;
  }
  return message.exitCode === 0
    ? <span className="fl-pill fl-pill-done">{t.agent.statusDone}</span>
    : <span className="fl-pill fl-pill-error">{interp(t.agent.statusFailed, { code: message.exitCode })}</span>;
}

export function AssistantMessage({ message }: Props) {
  const t = useT();
  const [thumbs, setThumbs] = useState<'up' | 'down' | null>(null);

  const agentLabel = (t.agent.modeLabel as Record<string, string>)[message.mode] ?? message.mode;
  const meta = [message.providerLabel, message.model].filter(Boolean).join(' · ');

  return (
    <div className="fl-row fl-row-asst">
      <span className="fl-msg-avatar" aria-hidden="true">
        <IconSparkle size={14} />
      </span>

      <div className="fl-asst-col">
        <div className="fl-asst-name">
          {t.agent.name}
          {agentLabel && (
            <span className="fl-asst-agent">· {agentLabel}</span>
          )}
          {meta && (
            <span className="fl-asst-agent" style={{ marginLeft: 'auto', fontSize: '11px' }}>
              {meta}
            </span>
          )}
        </div>

        <div className="fl-blocks">
          <PipelineSteps steps={message.steps} />

          {message.lines.length > 0 && (
            <div className="fl-text-block">
              {message.lines.map((line, i) => (
                <span
                  key={i}
                  className={line.kind === 'stderr' ? 'nx-line-stderr' : undefined}
                  style={{ display: 'block' }}
                >
                  {line.text}
                </span>
              ))}
              {message.isStreaming && <span className="fl-caret" />}
            </div>
          )}

          {message.isStreaming && message.lines.length === 0 && (
            <span className="fl-typing">
              <span /><span /><span />
            </span>
          )}

          {message.errorText && (
            <div style={{
              marginTop: 6, padding: '7px 10px',
              background: 'var(--colorPaletteRedBackground)',
              border: '1px solid rgba(232,121,121,0.3)',
              borderRadius: 'var(--borderRadiusLarge)',
              color: 'var(--colorPaletteRedForeground1)',
              fontSize: 12.5,
            }}>
              {message.errorText}
            </div>
          )}

          <StatusPill message={message} />
        </div>

        {!message.isStreaming && (
          <div className="fl-msg-actions">
            <button type="button" className="fl-act" title={t.agent.copy}>
              <IconCopy size={14} />
            </button>
            <button
              type="button"
              className={`fl-act${thumbs === 'up' ? ' fl-act-on' : ''}`}
              title={t.agent.goodResponse}
              onClick={() => setThumbs(v => v === 'up' ? null : 'up')}
            >
              <IconThumbUp size={14} />
            </button>
            <button
              type="button"
              className={`fl-act${thumbs === 'down' ? ' fl-act-on' : ''}`}
              title={t.agent.badResponse}
              onClick={() => setThumbs(v => v === 'down' ? null : 'down')}
            >
              <IconThumbDown size={14} />
            </button>
            <button type="button" className="fl-act" title={t.agent.retry}>
              <IconRetry size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
