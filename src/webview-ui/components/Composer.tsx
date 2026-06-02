import { useCallback, useRef, useState } from 'react';
import { IconSend, IconStop, IconAttach, IconAt, IconDoc, IconClose } from '../NexusIcons';
import { useT, interp } from '../i18n';

interface Attachment {
  name: string;
}

interface Props {
  isRunning: boolean;
  elapsed: number;
  onRun: (prompt: string) => void;
  onStop: () => void;
}

export function Composer({ isRunning, elapsed, onRun, onStop }: Props) {
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

      <div className="fl-input-wrap">
        <textarea
          ref={textareaRef}
          className="fl-input fl-scroll"
          placeholder={t.composer.placeholder}
          value={prompt}
          rows={1}
          disabled={isRunning}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          aria-label={t.composer.promptAriaLabel}
        />
        <div className="fl-input-tools">
          <button
            type="button"
            className="fl-iconbtn"
            title={t.composer.attachFile}
            onClick={() => setAttachments(prev => [...prev, { name: 'context.ts' }])}
          >
            <IconAttach size={15} />
          </button>
          <button
            type="button"
            className="fl-iconbtn"
            title={t.composer.mention}
            onClick={() => {
              setPrompt(v => v + '@');
              textareaRef.current?.focus();
            }}
          >
            <IconAt size={15} />
          </button>
          <button
            type="button"
            className="fl-iconbtn"
            title={t.composer.addFileContext}
            onClick={() => setAttachments(prev => [...prev, { name: 'open-file.ts' }])}
          >
            <IconDoc size={15} />
          </button>
        </div>
      </div>

      <div className="fl-composer-foot">
        <span className="fl-hint">
          {isRunning ? (
            <span className="fl-running">
              <span className="fl-spinner" style={{ width: 12, height: 12 }} />
              {interp(t.composer.working, { elapsed })}
            </span>
          ) : (
            <>
              <kbd>⌘</kbd>
              <kbd>↵</kbd>
              &nbsp;{t.composer.hintToSend}
            </>
          )}
        </span>

        {isRunning ? (
          <button type="button" className="fl-btn fl-btn-stop fl-btn-md" onClick={onStop}>
            <IconStop size={14} />
            {t.composer.stop}
          </button>
        ) : (
          <button
            type="button"
            className="fl-btn fl-btn-primary fl-btn-md"
            disabled={!prompt.trim()}
            onClick={handleRun}
          >
            <IconSend size={14} />
            {t.composer.send}
          </button>
        )}
      </div>
    </div>
  );
}
