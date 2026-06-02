import { useEffect, useRef } from 'react';
import { makeStyles } from '@fluentui/react-components';
import type { ChatMessage, Conversation } from '../messages';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';
import { GitStatusPanel } from './GitStatusPanel';

interface Props {
  conversation: Conversation;
  onOpenScm: () => void;
  onCloseGit: () => void;
}

const useStyles = makeStyles({
  container: {
    flex: '1',
    overflowY: 'auto',
    padding: '12px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  empty: {
    flex: '1',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    color: 'var(--vscode-descriptionForeground)',
    fontSize: '13px',
    opacity: '0.7',
    userSelect: 'none',
  },
  emptyDot: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'var(--vscode-activityBarBadge-background, #007acc)',
    opacity: '0.3',
  },
  anchor: {
    height: '1px',
    flexShrink: '0',
  },
});

function renderMessage(msg: ChatMessage) {
  if (msg.role === 'user') {
    return <UserMessage key={msg.id} message={msg} />;
  }
  return <AssistantMessage key={msg.id} message={msg} />;
}

export function MessageList({ conversation, onOpenScm, onCloseGit }: Props) {
  const styles = useStyles();
  const anchorRef = useRef<HTMLDivElement>(null);
  const { messages, gitChanges, gitMessage } = conversation;

  useEffect(() => {
    anchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, messages[messages.length - 1]]);

  if (messages.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyDot} />
        <span>Start a conversation</span>
      </div>
    );
  }

  return (
    <div className={styles.container} role="log" aria-live="polite" aria-label="Chat messages">
      {messages.map(renderMessage)}

      {gitChanges.length > 0 || gitMessage ? (
        <GitStatusPanel
          changes={gitChanges}
          message={gitMessage}
          onOpenScm={onOpenScm}
          onClose={onCloseGit}
        />
      ) : null}

      <div ref={anchorRef} className={styles.anchor} />
    </div>
  );
}
