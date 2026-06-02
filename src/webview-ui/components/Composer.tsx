import { useCallback, useRef, useState } from 'react';
import { IconSend, IconStop, IconAttach, IconAt, IconDoc, IconClose } from '../NexusIcons';

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
  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleRun = useCallback(() => {
    const trimmed = prompt.trim();
    if (!trimmed || isRunning) return;
    onRun(trimmed);
    setPrompt('');
    setAttachments([]);
    // reset height
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
    // auto-resize
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  };

  const removeAttachment = (i: number) =>
    setAttachments(prev => prev.filter((_, j) => j !== i));

  return (
    <div className="fl-composer">
      {/* Attachment chips */}
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
                aria-label={`Remove ${a.name}`}
              >
                <IconClose size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="fl-input-wrap">
        <textarea
          ref={textareaRef}
          className="fl-input fl-scroll"
          placeholder="Ask Nexus about this file…  (⌘↵ to send)"
          value={prompt}
          rows={1}
          disabled={isRunning}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          aria-label="Prompt input"
        />
        <div className="fl-input-tools">
          <button
            type="button"
            className="fl-iconbtn"
            title="Attach file"
            onClick={() => setAttachments(prev => [...prev, { name: 'context.ts' }])}
          >
            <IconAttach size={15} />
          </button>
          <button
            type="button"
            className="fl-iconbtn"
            title="Mention"
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
            title="Add file context"
            onClick={() => setAttachments(prev => [...prev, { name: 'open-file.ts' }])}
          >
            <IconDoc size={15} />
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="fl-composer-foot">
        <span className="fl-hint">
          {isRunning ? (
            <span className="fl-running">
              <span className="fl-spinner" style={{ width: 12, height: 12 }} />
              Nexus is working… {elapsed}s
            </span>
          ) : (
            <>
              <kbd>⌘</kbd>
              <kbd>↵</kbd>
              &nbsp;to send
            </>
          )}
        </span>

        {isRunning ? (
          <button type="button" className="fl-btn fl-btn-stop fl-btn-md" onClick={onStop}>
            <IconStop size={14} />
            Stop
          </button>
        ) : (
          <button
            type="button"
            className="fl-btn fl-btn-primary fl-btn-md"
            disabled={!prompt.trim()}
            onClick={handleRun}
          >
            <IconSend size={14} />
            Send
          </button>
        )}
      </div>
    </div>
  );
}
