import { useState } from 'react';
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
  const [confirmClear, setConfirmClear] = useState(false);

  const handleClearAll = () => {
    if (confirmClear) { onClearAll(); setConfirmClear(false); }
    else setConfirmClear(true);
  };

  return (
    <div className="nx-hist" role="listbox" aria-label={t.history.ariaLabel}>
      <div className="nx-hist-list">
        {conversations.map(conv => {
          const isActive = conv.id === activeId;
          return (
            <div
              key={conv.id}
              className="nx-hist-row"
              role="option"
              tabIndex={0}
              aria-selected={isActive}
              onClick={() => onSelect(conv.id)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelect(conv.id); }}
            >
              <span className={`nx-hist-dot${isActive ? ' nx-hist-dot-active' : ''}`} />
              <span className="nx-hist-title">{conv.title}</span>
              {conv.messages.length > 0 && (
                <span className="nx-hist-count">{conv.messages.length}</span>
              )}
              <button
                type="button"
                className="nx-hist-del"
                aria-label={t.history.deleteConversation}
                title={t.history.deleteConversation}
                onClick={e => { e.stopPropagation(); onDelete(conv.id); }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      {conversations.length > 0 && (
        <div className="nx-hist-foot">
          <button
            type="button"
            className={`nx-hist-clear${confirmClear ? ' nx-hist-clear-confirm' : ''}`}
            onClick={handleClearAll}
            onBlur={() => setConfirmClear(false)}
          >
            {confirmClear ? t.history.confirmClear : t.history.clearAll}
          </button>
        </div>
      )}
    </div>
  );
}
