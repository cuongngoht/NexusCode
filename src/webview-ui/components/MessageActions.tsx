import { useState, useEffect, useRef } from 'react';
import type { AssistantMessage } from '../messages';
import { IconCopy, IconThumbUp, IconThumbDown, IconRetry } from '../NexusIcons';
import { useT } from '../i18n';

interface Props {
  msg: AssistantMessage;
  onCopy: () => void;
  onRetry: (useCurrentSettings: boolean) => void;
  onFeedback: (rating: 'good' | 'bad' | null) => void;
  onViewPrompt?: () => void;
  disabled?: boolean;
}

export function MessageActions({ msg, onCopy, onRetry, onFeedback, onViewPrompt, disabled }: Props) {
  const t = useT();
  const [showRetryMenu, setShowRetryMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const retryContainerRef = useRef<HTMLDivElement>(null);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const currentFeedback = msg.feedback?.rating ?? null;

  // Close retry menu when clicking outside
  useEffect(() => {
    if (!showRetryMenu) return;
    const close = (e: MouseEvent) => {
      if (retryContainerRef.current && !retryContainerRef.current.contains(e.target as Node)) {
        setShowRetryMenu(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showRetryMenu]);

  return (
    <div className="fl-msg-actions" role="toolbar" aria-label="Message actions">
      <button
        type="button"
        className="fl-act"
        onClick={handleCopy}
        aria-label={copied ? t.agent.copied : t.agent.copy}
        title={copied ? t.agent.copied : t.agent.copy}
        disabled={disabled}
      >
        {copied ? '✓' : <IconCopy size={14} />}
      </button>

      <div className="msg-action-retry-container" ref={retryContainerRef}>
        <button
          type="button"
          className="fl-act"
          onClick={() => setShowRetryMenu(v => !v)}
          aria-label={t.agent.retry}
          aria-haspopup="true"
          aria-expanded={showRetryMenu}
          disabled={disabled}
          title={t.agent.retry}
        >
          <IconRetry size={14} />
        </button>
        {showRetryMenu && (
          <div className="retry-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => { onRetry(false); setShowRetryMenu(false); }}
            >
              {t.agent.retryWithOriginal}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => { onRetry(true); setShowRetryMenu(false); }}
            >
              {t.agent.retryWithCurrent}
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        className={`fl-act${currentFeedback === 'good' ? ' fl-act-on' : ''}`}
        onClick={() => onFeedback(currentFeedback === 'good' ? null : 'good')}
        aria-label={t.agent.feedbackGood}
        aria-pressed={currentFeedback === 'good'}
        title={t.agent.feedbackGood}
        disabled={disabled}
      >
        <IconThumbUp size={14} />
      </button>

      <button
        type="button"
        className={`fl-act${currentFeedback === 'bad' ? ' fl-act-on' : ''}`}
        onClick={() => onFeedback(currentFeedback === 'bad' ? null : 'bad')}
        aria-label={t.agent.feedbackBad}
        aria-pressed={currentFeedback === 'bad'}
        title={t.agent.feedbackBad}
        disabled={disabled}
      >
        <IconThumbDown size={14} />
      </button>

      {onViewPrompt && msg.enhancedPromptSnapshot && (
        <button
          type="button"
          className="fl-act"
          onClick={onViewPrompt}
          aria-label={t.agent.viewPrompt}
          title={t.agent.viewPrompt}
          disabled={disabled}
        >
          🔍
        </button>
      )}
    </div>
  );
}
