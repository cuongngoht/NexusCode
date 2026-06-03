import { useCallback, useRef, useState } from 'react';
import { NexusDropdown, type DropdownOption } from '../NexusDropdown';
import { IconAdd, IconStop, IconDoc, IconClose, IconArrowUp, IconSparkle, IconTool, IconGlobe, IconAgent, IconSearch } from '../NexusIcons';
import { useT, interp } from '../i18n';
import type { ProviderId, TaskMode, ProviderInfo } from '../messages';

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
  onRun: (prompt: string) => void;
  onStop: () => void;
  onProviderChange: (v: ProviderId) => void;
  onModeChange: (v: TaskMode) => void;
}

export function Composer({
  isRunning, elapsed, provider, mode,
  availableProviders, providerDetection,
  onRun, onStop, onProviderChange, onModeChange,
}: Props) {
  const t = useT();
  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleRun = useCallback(() => {
    const trimmed = prompt.trim();
    if (!trimmed || isRunning) return;
    onRun(trimmed);
    setPrompt('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    textareaRef.current?.focus();
  }, [prompt, isRunning, onRun]);

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

      <div className="fl-cmp-box">
        <textarea
          ref={textareaRef}
          className="fl-cmp-input fl-scroll"
          placeholder={t.composer.placeholder}
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
                disabled={!prompt.trim()}
                title={t.composer.send}
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
