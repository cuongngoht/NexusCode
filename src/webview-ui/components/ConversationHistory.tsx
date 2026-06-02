import { makeStyles } from '@fluentui/react-components';
import type { Conversation } from '../messages';

interface Props {
  conversations: Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
}

const useStyles = makeStyles({
  panel: {
    borderBottom: '1px solid var(--vscode-panel-border)',
    background: 'var(--vscode-sideBar-background)',
    maxHeight: '180px',
    overflowY: 'auto',
    flexShrink: '0',
  },
  list: {
    listStyle: 'none',
    margin: '0',
    padding: '4px 0',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '5px 14px',
    cursor: 'pointer',
    fontSize: '13px',
    color: 'var(--vscode-foreground)',
    ':hover': {
      background: 'var(--vscode-list-hoverBackground)',
    },
  },
  itemActive: {
    background: 'var(--vscode-list-activeSelectionBackground)',
    color: 'var(--vscode-list-activeSelectionForeground)',
  },
  dot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'var(--vscode-activityBarBadge-background, #007acc)',
    flexShrink: '0',
    opacity: '0',
  },
  dotActive: {
    opacity: '1',
  },
  title: {
    flex: '1',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '12px',
  },
  count: {
    fontSize: '10px',
    color: 'var(--vscode-descriptionForeground)',
    flexShrink: '0',
  },
});

export function ConversationHistory({ conversations, activeId, onSelect }: Props) {
  const styles = useStyles();

  return (
    <div className={styles.panel} role="navigation" aria-label="Conversation history">
      <ul className={styles.list}>
        {conversations.map(conv => {
          const isActive = conv.id === activeId;
          return (
            <li
              key={conv.id}
              className={`${styles.item}${isActive ? ` ${styles.itemActive}` : ''}`}
              onClick={() => onSelect(conv.id)}
              role="button"
              tabIndex={0}
              aria-current={isActive ? 'true' : undefined}
              onKeyDown={e => e.key === 'Enter' && onSelect(conv.id)}
            >
              <span className={`${styles.dot}${isActive ? ` ${styles.dotActive}` : ''}`} />
              <span className={styles.title}>{conv.title}</span>
              {conv.messages.length > 0 && (
                <span className={styles.count}>{conv.messages.length}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
