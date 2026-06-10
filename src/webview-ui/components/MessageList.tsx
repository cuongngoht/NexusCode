import { useEffect, useRef } from 'react';
import type { ChatMessage, Conversation, ProviderInfo } from '../messages';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';
import { GitStatusPanel } from './GitStatusPanel';
import { IconSparkle, IconChevronRight } from '../NexusIcons';
import { useT } from '../i18n';

interface Props {
  conversation: Conversation;
  isRunning: boolean;
  providerDetection: ProviderInfo[];
  availableProviders: string[];
  onOpenScm: () => void;
  onCloseGit: () => void;
  onSendSuggestion: (text: string) => void;
  onOpenFile: (path: string) => void;
  onAttachFiles: (paths: string[]) => void;
}

function EmptyState({ onSend }: { onSend: (text: string) => void }) {
  const t = useT();
  const suggestions = [t.emptyState.suggestion1, t.emptyState.suggestion2, t.emptyState.suggestion3];

  return (
    <div className="fl-empty">
      <div className="fl-empty-orb">
        <IconSparkle size={26} />
      </div>
      <div className="fl-empty-title">{t.emptyState.title}</div>
      <div className="fl-empty-sub">{t.emptyState.subtitle}</div>
      <div className="fl-suggest">
        {suggestions.map(s => (
          <button
            key={s}
            type="button"
            className="fl-suggest-chip"
            onClick={() => onSend(s)}
          >
            <IconSparkle size={13} className="chip-icon" />
            <span className="chip-text">{s}</span>
            <IconChevronRight size={13} className="fl-sc-arrow" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function MessageList({ conversation, isRunning, providerDetection, availableProviders, onOpenScm, onCloseGit, onSendSuggestion, onOpenFile, onAttachFiles }: Props) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, gitChanges, gitMessage } = conversation;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [messages.length, messages[messages.length - 1]]);

  return (
    <div className="fl-convo fl-scroll" ref={scrollRef} role="log" aria-live="polite">
      {messages.length === 0 ? (
        <EmptyState onSend={onSendSuggestion} />
      ) : (
        <div className="fl-thread">
          {messages.map((msg: ChatMessage) =>
            msg.role === 'user'
              ? <UserMessage key={msg.id} message={msg} />
              : <AssistantMessage key={msg.id} message={msg} isRunning={isRunning} providerDetection={providerDetection} availableProviders={availableProviders} />
          )}

          {(gitChanges.length > 0 || gitMessage) && (
            <GitStatusPanel
              changes={gitChanges}
              message={gitMessage}
              onOpenScm={onOpenScm}
              onClose={onCloseGit}
              onOpenFile={onOpenFile}
              onAttachFile={p => onAttachFiles([p])}
              onAttachAll={() => onAttachFiles(gitChanges.map(c => c.path))}
            />
          )}

          <div ref={anchorRef} style={{ height: 1 }} />
        </div>
      )}
    </div>
  );
}
