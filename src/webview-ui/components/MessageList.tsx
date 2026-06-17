import { memo, useEffect, useRef } from 'react';
import type { ChatMessage, Conversation, ProviderInfo, SubagentTraceState } from '../messages';
import type { CodeReviewReport } from '../../application/code-review/CodeReviewReport';
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
  subagentTrace?: SubagentTraceState;
  reviewHistory?: CodeReviewReport[];
  onOpenScm: () => void;
  onCloseGit: () => void;
  onSendSuggestion: (text: string) => void;
  onOpenFile: (path: string) => void;
  onAttachFiles: (paths: string[]) => void;
  onFeedback: (conversationId: string, messageId: string, rating: 'good' | 'bad' | null) => void;
  onRetry: (userMessageId: string, useCurrentSettings: boolean) => void;
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

export const MessageList = memo(function MessageList({ conversation, isRunning, providerDetection, availableProviders, subagentTrace, reviewHistory, onOpenScm, onCloseGit, onSendSuggestion, onOpenFile, onAttachFiles, onFeedback, onRetry }: Props) {
  const t = useT();
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
    <div
      className="fl-convo fl-scroll"
      ref={scrollRef}
      role="log"
      aria-label={t.history.messagesAriaLabel}
      aria-live="polite"
      aria-atomic="false"
    >
      {messages.length === 0 ? (
        <EmptyState onSend={onSendSuggestion} />
      ) : (
        <div className="fl-thread">
          {messages.map((msg: ChatMessage, index: number) => {
            if (msg.role === 'user') return <UserMessage key={msg.id} message={msg} />;
            // Find the preceding user message ID for retry
            let precedingUserMessageId: string | undefined;
            for (let i = index - 1; i >= 0; i--) {
              if (messages[i].role === 'user') {
                precedingUserMessageId = messages[i].id;
                break;
              }
            }
            // Only attach subagentTrace to the last streaming assistant message
            const isLastMessage = index === messages.length - 1;
            const isStreaming = msg.role === 'assistant' && (msg as import('../messages').AssistantMessage).isStreaming;
            const traceForMsg = isLastMessage && isStreaming ? subagentTrace : undefined;
            return (
              <AssistantMessage
                key={msg.id}
                message={msg}
                isRunning={isRunning}
                providerDetection={providerDetection}
                availableProviders={availableProviders}
                conversationId={conversation.id}
                userMessageId={precedingUserMessageId}
                subagentTrace={traceForMsg}
                reviewHistory={reviewHistory}
                onFeedback={(messageId, rating) => onFeedback(conversation.id, messageId, rating)}
                onRetry={onRetry}
              />
            );
          })}

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
});
