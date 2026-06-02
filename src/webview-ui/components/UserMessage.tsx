import { makeStyles } from '@fluentui/react-components';
import type { UserMessage as UserMsg } from '../messages';

interface Props {
  message: UserMsg;
}

const useStyles = makeStyles({
  root: {
    padding: '10px 14px',
    marginBottom: '2px',
    background: 'var(--vscode-input-background)',
    borderRadius: '6px',
    borderLeft: '2px solid var(--vscode-button-background)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '6px',
  },
  label: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--vscode-button-background)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  badges: {
    display: 'flex',
    gap: '4px',
  },
  badge: {
    fontSize: '10px',
    padding: '1px 5px',
    borderRadius: '3px',
    background: 'var(--vscode-badge-background)',
    color: 'var(--vscode-badge-foreground)',
    fontFamily: 'var(--vscode-font-family)',
  },
  prompt: {
    fontSize: '13px',
    lineHeight: '1.5',
    color: 'var(--vscode-editor-foreground)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: '0',
  },
});

export function UserMessage({ message }: Props) {
  const styles = useStyles();
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.label}>You</span>
        <span className={styles.badges}>
          <span className={styles.badge}>{message.provider}</span>
          <span className={styles.badge}>{message.mode}</span>
          {message.model && <span className={styles.badge}>{message.model}</span>}
        </span>
      </div>
      <p className={styles.prompt}>{message.prompt}</p>
    </div>
  );
}
