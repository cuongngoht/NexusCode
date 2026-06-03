import { useCallback, useEffect, useRef, useState } from 'react';
import { NexusDropdown, type DropdownOption } from '../NexusDropdown';
import { IconAdd, IconStop, IconDoc, IconClose, IconArrowUp, IconSparkle, IconTool, IconGlobe, IconAgent, IconSearch } from '../NexusIcons';
import { useT, interp } from '../i18n';
import type { ProviderId, TaskMode, ProviderInfo, ReviewContext } from '../messages';

interface Attachment {
  name: string;
}

interface Props {
  isRunning: boolean;
  elapsed: number;
  provider: ProviderId;
  mode: TaskMode;
  availableProviders: string[];
  providerDetection: ProviderInfo[];
  reviewContext?: ReviewContext;
  reviewContextError?: string;
  onRun: (prompt: string) => void;
  onStop: () => void;
  onProviderChange: (v: ProviderId) => void;
  onModeChange: (v: TaskMode) => void;
  onRefreshReviewContext: (baseBranch?: string) => void;
  onOpenReviewAgentFile: () => void;
}

export function Composer({
  isRunning, elapsed, provider, mode,
  availableProviders, providerDetection,
  reviewContext, reviewContextError,
  onRun, onStop, onProviderChange, onModeChange,
  onRefreshReviewContext, onOpenReviewAgentFile,
}: Props) {
  const t = useT();
  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedBase, setSelectedBase] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync selectedBase when reviewContext first loads or the server returns a different base branch
  useEffect(() => {
    if (reviewContext?.baseBranch && reviewContext.baseBranch !== selectedBase) {
      setSelectedBase(reviewContext.baseBranch);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewContext?.baseBranch]);

  const handleRun = useCallback(() => {
    const trimmed = prompt.trim();
    if ((!trimmed && mode !== 'review') || isRunning) return;
    onRun(trimmed);
    setPrompt('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    textareaRef.current?.focus();
  }, [prompt, isRunning, mode, onRun]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
    },
    [handleRun],
  );

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  };

  const removeAttachment = (i: number) =>
    setAttachments(prev => prev.filter((_, j) => j !== i));

  // Provider options
  const availableSet = new Set(availableProviders);
  const detectionDone = providerDetection.length > 0;
  const all: ProviderId[] = ['auto', 'claude', 'codex', 'gemini', 'copilot', 'aider', 'custom'];
  const providerOptions: DropdownOption[] = all
    .filter(id => {
      if (id === 'auto' || id === 'custom') return true;
      if (!detectionDone) return false;
      return availableSet.has(id);
    })
    .map(id => {
      if (id === 'auto') return { value: 'auto', label: t.provider.autoDetect, icon: IconSparkle, badge: t.provider.autoDetectBadge };
      if (id === 'custom') return { value: 'custom', label: t.provider.customCli, icon: IconTool };
      const info = providerDetection.find(d => d.id === id);
      const label = info ? (info.version ? `${info.cliLabel} ${info.version}` : info.cliLabel) : id;
      return { value: id, label, icon: IconSparkle };
    });

  // Mode options
  const modeOptions: DropdownOption[] = [
    { value: 'ask', label: t.mode.ask.label, desc: t.mode.ask.desc, icon: IconSparkle },
    { value: 'edit', label: t.mode.edit.label, desc: t.mode.edit.desc, icon: IconTool },
    { value: 'research', label: t.mode.research.label, desc: t.mode.research.desc, icon: IconGlobe },
    { value: 'brainstorm', label: t.mode.brainstorm.label, desc: t.mode.brainstorm.desc, icon: IconSparkle },
    { value: 'review', label: t.mode.review.label, desc: t.mode.review.desc, icon: IconAgent },
    { value: 'debug', label: t.mode.debug.label, desc: t.mode.debug.desc, icon: IconSearch },
    { value: 'plan', label: t.mode.plan.label, desc: t.mode.plan.desc, icon: IconSparkle },
    { value: 'test', label: t.mode.test.label, desc: t.mode.test.desc, icon: IconTool },
    { value: 'scan-project', label: t.mode['scan-project'].label, desc: t.mode['scan-project'].desc, icon: IconSearch },
  ];

  return (
    <div className="fl-composer">
      {attachments.length > 0 && (
        <div className="fl-composer-atts">
          {attachments.map((a, i) => (
            <span key={i} className="fl-att-chip">
              <IconDoc size={13} />
              {a.name}
              <button
                type="button"
                className="fl-att-chip-remove"
                onClick={() => removeAttachment(i)}
                aria-label={interp(t.composer.removeAttachment, { name: a.name })}
              >
                <IconClose size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {mode === 'review' && (
        <div className="nx-review-panel">
          <div className="nx-review-panel-header">
            <span className="nx-review-title">{t.review.panelTitle}</span>
            <div className="nx-review-actions">
              <button type="button" onClick={() => onRefreshReviewContext(selectedBase || undefined)} disabled={isRunning}>
                {t.review.refresh}
              </button>
              <button type="button" onClick={onOpenReviewAgentFile} disabled={isRunning}>
                {t.review.editAgent}
              </button>
            </div>
          </div>

          <div className="nx-review-branch-row">
            <div className="nx-review-branch-group">
              <label className="nx-review-branch-label">{t.review.labelBase}</label>
              {reviewContext?.availableBranches?.length ? (
                <select
                  className="nx-review-branch-select"
                  value={selectedBase}
                  disabled={isRunning}
                  onChange={e => {
                    const val = e.target.value;
                    setSelectedBase(val);
                    onRefreshReviewContext(val);
                  }}
                >
                  {reviewContext.availableBranches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              ) : (
                <span className="nx-review-branch-value">{selectedBase || t.review.loading}</span>
              )}
            </div>

            <span className="nx-review-arrow">→</span>

            <div className="nx-review-branch-group">
              <label className="nx-review-branch-label">{t.review.labelCompare}</label>
              <span className="nx-review-branch-value nx-review-branch-value--compare">
                {reviewContext?.compareBranch || t.review.loading}
              </span>
            </div>
          </div>

          {reviewContextError && (
            <div className="nx-review-error">{reviewContextError}</div>
          )}

          {reviewContext?.message && (
            <div className="nx-review-error">{reviewContext.message}</div>
          )}

          {reviewContext && !reviewContext.message && (
            <div className="nx-review-meta">
              <span>{interp(t.review.metaChangedFiles, { count: String(reviewContext.changedFiles.length) })}</span>
            </div>
          )}

          {reviewContext?.diffStat && (
            <pre className="nx-review-stat">{reviewContext.diffStat}</pre>
          )}
        </div>
      )}

      <div className="fl-cmp-box">
        <textarea
          ref={textareaRef}
          className="fl-cmp-input fl-scroll"
          placeholder={mode === 'review' ? t.review.placeholder : t.composer.placeholder}
          value={prompt}
          rows={1}
          disabled={isRunning}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          aria-label={t.composer.promptAriaLabel}
        />

        <div className="fl-cmp-bar">
          <div className="fl-cmp-bar-left">
            <button
              type="button"
              className="fl-cmp-add"
              title={t.composer.attachFile}
              onClick={() => setAttachments(prev => [...prev, { name: 'context.ts' }])}
            >
              <IconAdd size={16} />
            </button>
          </div>

          <div className="fl-cmp-bar-right">
            {isRunning ? (
              <>
                <span className="fl-running" style={{ fontSize: 11.5 }}>
                  <span className="fl-spinner" style={{ width: 10, height: 10 }} />
                  {interp(t.composer.working, { elapsed })}
                </span>
                <button type="button" className="fl-cmp-stop-btn" title={t.composer.stop} onClick={onStop}>
                  <IconStop size={13} />
                </button>
              </>
            ) : (
              <button
                type="button"
                className="fl-cmp-send-btn"
                disabled={mode !== 'review' && !prompt.trim()}
                title={mode === 'review' ? t.review.sendTitle : t.composer.send}
                onClick={handleRun}
              >
                <IconArrowUp size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="fl-selectors fl-selectors--bottom">
        <NexusDropdown
          value={provider}
          options={providerOptions}
          onChange={v => onProviderChange(v as ProviderId)}
          disabled={isRunning}
          direction="up"
          searchable
        />
        <NexusDropdown
          value={mode}
          options={modeOptions}
          onChange={v => onModeChange(v as TaskMode)}
          disabled={isRunning}
          direction="up"
        />
      </div>
    </div>
  );
}
