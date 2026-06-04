import { useState } from 'react';
import type { ConversationTokenUsage } from '../../core/tokens/TokenUsage';
import { useT } from '../i18n';

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

interface Props {
  usage: ConversationTokenUsage;
  isRunning: boolean;
  enhancedPrompt?: string;
}

function TokenBarContent({
  usage,
  isRunning,
  expanded,
}: {
  usage: ConversationTokenUsage;
  isRunning: boolean;
  expanded: boolean;
}) {
  const providers = Object.values(usage.byProvider)
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, 3);

  return (
    <>
      <div className="nx-token-main">
        <span className="nx-token-total">
          {formatTokens(usage.totalTokens)} tokens
        </span>
        <span className="nx-token-muted">
          {formatTokens(usage.inputTokens)} in / {formatTokens(usage.outputTokens)} out
        </span>
        <span className="nx-token-muted">
          {usage.runs} run{usage.runs === 1 ? '' : 's'}
        </span>
        {isRunning && <span className="nx-token-live">running</span>}
      </div>
      <div className="nx-token-providers">
        {providers.map(p => (
          <span key={p.provider} className="nx-token-chip">
            {p.label}: {formatTokens(p.totalTokens)}
          </span>
        ))}
        <span className="nx-token-chevron">{expanded ? '▲' : '▼'}</span>
      </div>
    </>
  );
}

export function ConversationTokenBar({ usage, isRunning, enhancedPrompt }: Props) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  if (!usage || usage.runs === 0) return null;

  return (
    <div className="nx-token-bar-wrapper">
      {enhancedPrompt ? (
        <button
          type="button"
          className={`nx-token-bar nx-token-bar--btn${expanded ? ' nx-token-bar--expanded' : ''}`}
          title={t.agent.inspectPrompt}
          onClick={() => setExpanded(v => !v)}
        >
          <TokenBarContent usage={usage} isRunning={isRunning} expanded={expanded} />
        </button>
      ) : (
        <div className="nx-token-bar">
          <TokenBarContent usage={usage} isRunning={isRunning} expanded={false} />
        </div>
      )}

      {expanded && enhancedPrompt && (
        <div className="nx-inspect-prompt">
          <div className="nx-inspect-prompt-header">
            <span>{t.agent.inspectPromptTitle}</span>
            <button
              type="button"
              className="nx-inspect-prompt-close"
              title={t.git.close}
              onClick={() => setExpanded(false)}
            >
              ✕
            </button>
          </div>
          <pre className="nx-inspect-prompt-body fl-scroll">{enhancedPrompt}</pre>
        </div>
      )}
    </div>
  );
}
