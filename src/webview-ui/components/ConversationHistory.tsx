import type { Conversation } from '../messages';

interface Props {
  conversations: Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function ConversationHistory({ conversations, activeId, onSelect }: Props) {
  return (
    <nav className="nx-history fl-scroll" aria-label="Conversation history">
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
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
