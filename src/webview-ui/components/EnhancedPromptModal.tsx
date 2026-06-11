import { useRef, useState, useEffect } from 'react';
import type { EnhancedPromptSnapshot } from '../messages';
import { useT } from '../i18n';

interface Props {
  snapshot: EnhancedPromptSnapshot;
  onClose: () => void;
}

export function EnhancedPromptModal({ snapshot, onClose }: Props) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'enhanced' | 'original'>('enhanced');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Auto-focus first focusable element on mount
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;
    const focusable = modal.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
  }, []);

  // Focus trap: keep Tab/Shift+Tab within the modal
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const modal = modalRef.current;
    if (!modal) return;
    const focusables = Array.from(
      modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const handleCopy = async () => {
    const text = activeTab === 'enhanced' ? snapshot.enhancedPrompt : snapshot.originalPrompt;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const toggleSection = (title: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title); else next.add(title);
      return next;
    });
  };

  return (
    <div
      className="enhanced-prompt-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t.agent.promptModalTitle}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="enhanced-prompt-modal" ref={modalRef} onKeyDown={handleKeyDown}>
        <div className="ep-header">
          <div className="ep-tabs">
            <button
              type="button"
              className={`ep-tab${activeTab === 'enhanced' ? ' active' : ''}`}
              onClick={() => setActiveTab('enhanced')}
              aria-selected={activeTab === 'enhanced'}
            >
              {t.agent.promptTabEnhanced}
            </button>
            <button
              type="button"
              className={`ep-tab${activeTab === 'original' ? ' active' : ''}`}
              onClick={() => setActiveTab('original')}
              aria-selected={activeTab === 'original'}
            >
              {t.agent.promptTabOriginal}
            </button>
          </div>
          <div className="ep-actions">
            <button type="button" className="ep-btn" onClick={handleCopy} aria-label={t.agent.promptCopy}>
              {copied ? t.agent.promptCopied : t.agent.promptCopy}
            </button>
            <button type="button" className="ep-btn ep-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        {snapshot.wasTruncated && (
          <div className="ep-warning" role="alert">
            {t.agent.promptTruncatedWarning}
          </div>
        )}

        <div className="ep-body">
          {activeTab === 'enhanced' && snapshot.sections.length > 0 ? (
            <div className="ep-sections">
              {snapshot.sections.map((sec) => (
                <div key={sec.title} className="ep-section">
                  <button
                    type="button"
                    className="ep-section-header"
                    onClick={() => toggleSection(sec.title)}
                    aria-expanded={!collapsedSections.has(sec.title)}
                  >
                    <span className="ep-section-icon">
                      {collapsedSections.has(sec.title) ? '▶' : '▼'}
                    </span>
                    <span className="ep-section-title">{sec.title}</span>
                    <span className="ep-section-chars">{sec.content.length} chars</span>
                  </button>
                  {!collapsedSections.has(sec.title) && (
                    <pre className="ep-section-content">{sec.content}</pre>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <pre className="ep-content">
              {activeTab === 'enhanced' ? snapshot.enhancedPrompt : snapshot.originalPrompt}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
