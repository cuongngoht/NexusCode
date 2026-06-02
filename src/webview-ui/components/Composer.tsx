import { useCallback, useRef, useState } from 'react';
import { makeStyles, Button, Textarea, Tooltip } from '@fluentui/react-components';
import { SendRegular, StopRegular } from '@fluentui/react-icons';

interface Props {
  isRunning: boolean;
  onRun: (prompt: string) => void;
  onStop: () => void;
}

const useStyles = makeStyles({
  footer: {
    borderTop: '1px solid var(--vscode-panel-border)',
    padding: '8px 10px',
    background: 'var(--vscode-sideBar-background)',
    flexShrink: '0',
  },
  textarea: {
    width: '100%',
    '& textarea': {
      background: 'var(--vscode-input-background)',
      color: 'var(--vscode-input-foreground)',
      border: '1px solid var(--vscode-input-border, transparent)',
      fontFamily: 'var(--vscode-font-family)',
      fontSize: '13px',
      resize: 'none',
      lineHeight: '1.5',
      minHeight: '60px',
      maxHeight: '160px',
    },
    '& textarea:focus': {
      outline: '1px solid var(--vscode-focusBorder)',
      outlineOffset: '0',
      border: '1px solid var(--vscode-focusBorder)',
    },
    '& textarea::placeholder': {
      color: 'var(--vscode-input-placeholderForeground)',
    },
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '6px',
    gap: '6px',
  },
  hint: {
    fontSize: '10px',
    color: 'var(--vscode-descriptionForeground)',
    opacity: '0.7',
    userSelect: 'none',
  },
  buttons: {
    display: 'flex',
    gap: '6px',
  },
  sendBtn: {
    background: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
    border: 'none',
    minWidth: 'unset',
    '&:hover:not([disabled])': { background: 'var(--vscode-button-hoverBackground)' },
  },
  stopBtn: {
    background: 'var(--vscode-inputValidation-errorBackground, #5a1d1d)',
    color: 'var(--vscode-errorForeground, #f48771)',
    border: '1px solid var(--vscode-inputValidation-errorBorder, #be1100)',
    minWidth: 'unset',
    '&:hover:not([disabled])': { opacity: '0.85' },
  },
});

export function Composer({ isRunning, onRun, onStop }: Props) {
  const styles = useStyles();
  const [prompt, setPrompt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleRun = useCallback(() => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    onRun(trimmed);
    setPrompt('');
    textareaRef.current?.focus();
  }, [prompt, onRun]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
    },
    [handleRun],
  );

  return (
    <footer className={styles.footer}>
      <Textarea
        ref={textareaRef}
        className={styles.textarea}
        value={prompt}
        disabled={isRunning}
        placeholder="Ask Nexus anything… (⌘↵ to send)"
        aria-label="Prompt input"
        onChange={(_e, d) => setPrompt(d.value)}
        onKeyDown={handleKeyDown}
      />
      <div className={styles.row}>
        <span className={styles.hint}>⌘↵ to send</span>
        <div className={styles.buttons}>
          {isRunning ? (
            <Tooltip content="Stop task" relationship="label">
              <Button size="small" icon={<StopRegular />}
                className={styles.stopBtn} onClick={onStop}>
                Stop
              </Button>
            </Tooltip>
          ) : (
            <Tooltip content="Send (⌘↵)" relationship="label">
              <Button size="small" icon={<SendRegular />}
                className={styles.sendBtn}
                disabled={!prompt.trim()}
                onClick={handleRun}>
                Send
              </Button>
            </Tooltip>
          )}
        </div>
      </div>
    </footer>
  );
}
