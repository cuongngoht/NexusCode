import { useState } from 'react';
import type { AssistantMessage as AssistantMsg } from '../messages';
import { IconSparkle, IconCopy, IconThumbUp, IconThumbDown, IconRetry } from '../NexusIcons';

const MODE_AGENT_LABEL: Record<string, string> = {
  ask: 'Ask',
  edit: 'Build Agent',
  research: 'Research Agent',
  review: 'Code Reviewer',
  debug: 'Debug Agent',
  plan: 'Planner',
  test: 'Test Agent',
  'scan-project': 'Scan Project',
};

interface Props {
  message: AssistantMsg;
  isRunning?: boolean;
}

function StatusPill({ message }: { message: AssistantMsg }) {
  if (message.isStreaming) {
    return (
      <span className="fl-pill fl-pill-running">
        <span className="fl-spinner" style={{ width: 10, height: 10 }} />
        Running
      </span>
    );
  }
  if (message.errorText) {
    return <span className="fl-pill fl-pill-error">✖ Error</span>;
  }
  if (message.exitCode === undefined) {
    return <span className="fl-pill fl-pill-stopped">⏹ Stopped</span>;
  }
  return message.exitCode === 0
    ? <span className="fl-pill fl-pill-done">✓ Done</span>
    : <span className="fl-pill fl-pill-error">✖ Failed ({message.exitCode})</span>;
}

export function AssistantMessage({ message }: Props) {
  const [thumbs, setThumbs] = useState<'up' | 'down' | null>(null);

  const agentLabel = MODE_AGENT_LABEL[message.mode] ?? message.mode;
  const meta = [message.providerLabel, message.model].filter(Boolean).join(' · ');

  return (
    <div className="fl-row fl-row-asst">
      <span className="fl-msg-avatar" aria-hidden="true">
        <IconSparkle size={14} />
      </span>

      <div className="fl-asst-col">
        <div className="fl-asst-name">
          Nexus
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
          {/* Render output lines as text block */}
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
              {message.isStreaming && (
                <span className="fl-caret" />
              )}
            </div>
          )}

          {/* Typing indicator when streaming with no lines yet */}
          {message.isStreaming && message.lines.length === 0 && (
            <span className="fl-typing">
              <span /><span /><span />
            </span>
          )}

          {/* Error box */}
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

          {/* Status pill */}
          <StatusPill message={message} />
        </div>

        {/* Action row (copy / thumbs / retry) */}
        {!message.isStreaming && (
          <div className="fl-msg-actions">
            <button type="button" className="fl-act" title="Copy">
              <IconCopy size={14} />
            </button>
            <button
              type="button"
              className={`fl-act${thumbs === 'up' ? ' fl-act-on' : ''}`}
              title="Good response"
              onClick={() => setThumbs(v => v === 'up' ? null : 'up')}
            >
              <IconThumbUp size={14} />
            </button>
            <button
              type="button"
              className={`fl-act${thumbs === 'down' ? ' fl-act-on' : ''}`}
              title="Bad response"
              onClick={() => setThumbs(v => v === 'down' ? null : 'down')}
            >
              <IconThumbDown size={14} />
            </button>
            <button type="button" className="fl-act" title="Retry">
              <IconRetry size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
