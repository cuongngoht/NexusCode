import { makeStyles, Spinner } from '@fluentui/react-components';
import type { AssistantMessage as AssistantMsg } from '../messages';

interface Props {
  message: AssistantMsg;
}

const useStyles = makeStyles({
  root: {
    padding: '10px 14px',
    marginBottom: '2px',
    borderRadius: '6px',
    borderLeft: '2px solid var(--vscode-activityBarBadge-background, #007acc)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '8px',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'var(--vscode-activityBarBadge-background, #007acc)',
    flexShrink: '0',
  },
  name: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--vscode-activityBarBadge-background, #007acc)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  provider: {
    fontSize: '10px',
    color: 'var(--vscode-descriptionForeground)',
    marginLeft: 'auto',
  },
  lines: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    fontFamily: 'var(--vscode-editor-font-family, monospace)',
    fontSize: '12px',
    lineHeight: '1.5',
  },
  stdout: {
    color: 'var(--vscode-editor-foreground)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  stderr: {
    color: 'var(--vscode-inputValidation-warningForeground, #ddb130)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  footer: {
    marginTop: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
  },
  statusDone: {
    color: 'var(--vscode-testing-iconPassed, #89d185)',
  },
  statusError: {
    color: 'var(--vscode-errorForeground)',
  },
  statusStopped: {
    color: 'var(--vscode-descriptionForeground)',
  },
  errorBox: {
    marginTop: '6px',
    padding: '6px 8px',
    background: 'var(--vscode-inputValidation-errorBackground, #5a1d1d)',
    border: '1px solid var(--vscode-inputValidation-errorBorder, #be1100)',
    borderRadius: '4px',
    color: 'var(--vscode-errorForeground)',
    fontSize: '12px',
    wordBreak: 'break-word',
  },
});

export function AssistantMessage({ message }: Props) {
  const styles = useStyles();
  const meta = [message.providerLabel, message.mode, message.model].filter(Boolean).join(' · ');

  const renderFooter = () => {
    if (message.errorText) {
      return <span className={styles.statusError}>✖ Error</span>;
    }
    if (message.isStreaming) {
      return (
        <>
          <Spinner size="extra-tiny" />
          <span style={{ color: 'var(--vscode-descriptionForeground)', fontSize: '11px' }}>Running…</span>
        </>
      );
    }
    if (message.exitCode === undefined) {
      return <span className={styles.statusStopped}>⏹ Stopped</span>;
    }
    return message.exitCode === 0
      ? <span className={styles.statusDone}>✓ Done (exit 0)</span>
      : <span className={styles.statusError}>✖ Failed (exit {message.exitCode})</span>;
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.dot} />
        <span className={styles.name}>Nexus</span>
        <span className={styles.provider}>{meta}</span>
      </div>

      {message.lines.length > 0 && (
        <div className={styles.lines}>
          {message.lines.map((line, i) => (
            <span key={i} className={line.kind === 'stderr' ? styles.stderr : styles.stdout}>
              {line.text}
            </span>
          ))}
        </div>
      )}

      {message.errorText && (
        <div className={styles.errorBox}>{message.errorText}</div>
      )}

      <div className={styles.footer}>{renderFooter()}</div>
    </div>
  );
}
