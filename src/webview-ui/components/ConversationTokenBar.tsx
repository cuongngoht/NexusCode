import { useState } from 'react';
import type { ConversationTokenUsage, TokenUsageSource } from '../../core/tokens/TokenUsage';
import { interp, useT } from '../i18n';

const WARN_TOKENS = 50_000;
const ERROR_TOKENS = 80_000;

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

function dominantSource(usage: ConversationTokenUsage): TokenUsageSource | null {
  if (usage.runs === 0) return null;
  let exact = 0, estimated = 0, heuristic = 0;
  for (const p of Object.values(usage.byProvider)) {
    exact += p.sourceBreakdown.exact ?? 0;
    estimated += p.sourceBreakdown.estimated ?? 0;
    heuristic += p.sourceBreakdown.heuristic ?? 0;
  }
  if (exact === 0 && estimated === 0 && heuristic === 0) return null;
  if (exact >= estimated && exact >= heuristic) return 'exact';
  if (estimated >= heuristic) return 'estimated';
  return 'heuristic';
}

interface Props {
  usage: ConversationTokenUsage;
  isRunning: boolean;
  enhancedPrompt?: string;
  onCompact?: () => void;
}

export function ConversationTokenBar({ usage, isRunning, enhancedPrompt, onCompact }: Props) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  if (!usage || usage.runs === 0) return null;

  const tokenState: 'normal' | 'warn' | 'danger' =
    usage.totalTokens >= ERROR_TOKENS ? 'danger' :
    usage.totalTokens >= WARN_TOKENS ? 'warn' : 'normal';

  const source = dominantSource(usage);

  const providers = Object.values(usage.byProvider)
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, 3);

  const stateClass =
    tokenState === 'danger' ? ' nx-token-bar--danger' :
    tokenState === 'warn' ? ' nx-token-bar--warn' : '';

  const nk = Math.round(usage.totalTokens / 1000);

  return (
    <div className="nx-token-bar-wrapper">
      <div className={`nx-token-bar${stateClass}`}>
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
          {source && source !== 'exact' && (
            <span className={`nx-token-source nx-token-source--${source}`}>
              {source === 'estimated' ? 'est.' : 'approx.'}
            </span>
          )}
          {isRunning && <span className="nx-token-live">running</span>}
        </div>

        <div className="nx-token-providers">
          {providers.map(p => (
            <span key={p.provider} className="nx-token-chip">
              {p.label}: {formatTokens(p.totalTokens)}
            </span>
          ))}
          {tokenState !== 'normal' && onCompact && !isRunning && (
            <button
              type="button"
              className="nx-token-compact-btn"
              title={t.compact.compactConversation}
              onClick={onCompact}
            >
              {t.compact.compactAction}
            </button>
          )}
          {enhancedPrompt && (
            <button
              type="button"
              className="nx-token-inspect-btn"
              title={t.agent.inspectPrompt}
              onClick={() => setExpanded(v => !v)}
              aria-expanded={expanded}
            >
              {expanded ? '▲' : '▼'}
            </button>
          )}
        </div>
      </div>

      {tokenState !== 'normal' && (
        <div className={`nx-token-state-msg nx-token-state-msg--${tokenState}`}>
          {tokenState === 'danger'
            ? interp(t.compact.tokenDanger, { n: nk })
            : interp(t.compact.tokenWarning, { n: nk })}
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
