import type { Conversation } from '../messages';
import { useT } from '../i18n';

interface Props {
  conversations: Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

export function ConversationHistory({ conversations, activeId, onSelect, onDelete, onClearAll }: Props) {
  const t = useT();
  return (
    <nav className="nx-history fl-scroll" aria-label={t.history.ariaLabel}>
      <ul className="nx-history-list">
        {conversations.map(conv => {
          const isActive = conv.id === activeId;
          return (
            <li
              key={conv.id}
              className="nx-history-item"
              data-active={isActive ? '1' : undefined}
              role="button"
              tabIndex={0}
              aria-current={isActive ? 'true' : undefined}
              onClick={() => onSelect(conv.id)}
              onKeyDown={e => e.key === 'Enter' && onSelect(conv.id)}
            >
              <span className="nx-history-dot" />
              <span className="nx-history-title">{conv.title}</span>
              {conv.messages.length > 0 && (
                <span className="nx-history-count">{conv.messages.length}</span>
              )}
              <button
                type="button"
                className="nx-history-delete"
                aria-label={t.history.deleteConversation}
                title={t.history.deleteConversation}
                onClick={e => { e.stopPropagation(); onDelete(conv.id); }}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
      {conversations.length > 1 && (
        <div className="nx-history-footer">
          <button
            type="button"
            className="nx-history-clear"
            onClick={onClearAll}
          >
            {t.history.clearAll}
          </button>
        </div>
      )}
    </nav>
  );
}
