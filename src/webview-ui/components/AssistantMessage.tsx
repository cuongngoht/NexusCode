import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { AssistantMessage as AssistantMsg, PipelineStep, Activity, ProviderInfo, TaskMode } from '../messages';
import { IconSparkle } from '../NexusIcons';
import { useT, interp } from '../i18n';
import { getVsCodeApi } from '../vscodeApi';
import { PlanReadyCard } from './PlanReadyCard';
import { MessageActions } from './MessageActions';
import { EnhancedPromptModal } from './EnhancedPromptModal';

interface Props {
  message: AssistantMsg;
  isRunning?: boolean;
  providerDetection?: ProviderInfo[];
  availableProviders?: string[];
  conversationId: string;
  userMessageId?: string;
  onFeedback: (messageId: string, rating: 'good' | 'bad' | null) => void;
  onRetry: (userMessageId: string, useCurrentSettings: boolean) => void;
}

function StepIcon({ status }: { status: PipelineStep['status'] }) {
  if (status === 'running') {
    return <span className="fl-spinner nx-step-spinner" />;
  }
  if (status === 'done') {
    return <span className="nx-step-icon nx-step-done">✓</span>;
  }
  return <span className="nx-step-icon nx-step-error">✗</span>;
}

const ACTIVITY_KIND_ICONS: Record<string, string> = {
  read: '📄', edit: '✏️', bash: '⚡', write: '📝', todo: '☑', search: '🔍', tool_call: '⚙',
};

function ActivityIcon({ status }: { status: Activity['status'] }) {
  if (status === 'running') return <span className="fl-spinner nx-activity-spinner" />;
  if (status === 'done') return <span className="nx-activity-icon nx-activity-done">✓</span>;
  return <span className="nx-activity-icon nx-activity-error">✗</span>;
}

function ActivityList({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) return null;
  return (
    <div className="nx-activities">
      {activities.map((act, j) => (
        <div key={j} className={`nx-activity nx-activity-${act.status}`}>
          <ActivityIcon status={act.status} />
          <span className="nx-activity-kind-icon">{ACTIVITY_KIND_ICONS[act.kind] ?? '⚙'}</span>
          <span className="nx-activity-label">{act.label}</span>
        </div>
      ))}
    </div>
  );
}

function PipelineSteps({ steps }: { steps: PipelineStep[] }) {
  const t = useT();
  if (steps.length === 0) { return null; }
  const stepLabels = t.pipeline.steps as Record<string, string>;
  return (
    <div className="nx-steps">
      {steps.map((step, i) => (
        <div key={i}>
          <div className={`nx-step nx-step-${step.status}`}>
            <StepIcon status={step.status} />
            <span className="nx-step-label">{stepLabels[step.label] ?? step.label}</span>
          </div>
          <ActivityList activities={step.activities} />
        </div>
      ))}
    </div>
  );
}

function StatusPill({ message }: { message: AssistantMsg }) {
  const t = useT();
  if (message.isStreaming) {
    return (
      <span className="fl-pill fl-pill-running">
        <span className="fl-spinner" style={{ width: 10, height: 10 }} />
        {t.agent.statusRunning}
      </span>
    );
  }
  if (message.errorText) {
    return <span className="fl-pill fl-pill-error">{t.agent.statusError}</span>;
  }
  if (message.exitCode === undefined) {
    return <span className="fl-pill fl-pill-stopped">{t.agent.statusStopped}</span>;
  }
  return message.exitCode === 0
    ? <span className="fl-pill fl-pill-done">{t.agent.statusDone}</span>
    : <span className="fl-pill fl-pill-error">{interp(t.agent.statusFailed, { code: message.exitCode })}</span>;
}

export const AssistantMessage = memo(function AssistantMessage({
  message,
  providerDetection = [],
  availableProviders = [],
  conversationId,
  userMessageId,
  onFeedback,
  onRetry,
}: Props) {
  const t = useT();
  const [showPromptModal, setShowPromptModal] = useState(false);

  const agentLabel = (t.agent.modeLabel as Record<string, string>)[message.mode] ?? message.mode;
  const meta = [message.providerLabel, message.model].filter(Boolean).join(' · ');

  const handleCopy = () => {
    const text = message.lines.filter(l => l.kind === 'stdout').map(l => l.text).join('\n');
    try {
      navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  };

  const handleRetry = (useCurrentSettings: boolean) => {
    const msgId = message.retrySourceMessageId ?? userMessageId;
    if (msgId) {
      onRetry(msgId, useCurrentSettings);
    }
  };

  return (
    <div className="fl-row fl-row-asst" role="article" aria-label={t.agent.name}>
      <span className="fl-msg-avatar" aria-hidden="true">
        <IconSparkle size={14} />
      </span>

      <div className="fl-asst-col">
        <div className="fl-asst-name">
          {t.agent.name}
          {agentLabel && (
            <span className="fl-asst-agent">· {agentLabel}</span>
          )}
          {meta && (
            <span className="fl-asst-agent" style={{ marginLeft: 'auto', fontSize: '11px' }}>
              {meta}
            </span>
          )}
        </div>

        <div className="fl-blocks">
          <PipelineSteps steps={message.steps} />

          {message.lines.length > 0 && (() => {
            const stdoutText = message.lines
              .filter(l => l.kind === 'stdout')
              .map(l => l.text)
              .join('\n');
            const stderrLines = message.lines.filter(l => l.kind === 'stderr');
            return (
              <div className="fl-text-block">
                {stdoutText && (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                  >
                    {stdoutText}
                  </ReactMarkdown>
                )}
                {stderrLines.map((line, i) => (
                  <span key={i} className="nx-line-stderr" style={{ display: 'block' }}>
                    {line.text}
                  </span>
                ))}
                {message.isStreaming && <span className="fl-caret" />}
              </div>
            );
          })()}

          {message.isStreaming && message.lines.length === 0 && (
            <span className="fl-typing">
              <span /><span /><span />
            </span>
          )}

          {message.errorText && (
            <div style={{
              marginTop: 6, padding: '7px 10px',
              background: 'var(--colorPaletteRedBackground)',
              border: '1px solid rgba(232,121,121,0.3)',
              borderRadius: 'var(--borderRadiusLarge)',
              color: 'var(--colorPaletteRedForeground1)',
              fontSize: 12.5,
            }}>
              {message.errorText}
            </div>
          )}

          <StatusPill message={message} />
        </div>

        {!message.isStreaming && (
          <MessageActions
            msg={message}
            onCopy={handleCopy}
            onRetry={handleRetry}
            onFeedback={(rating) => onFeedback(message.id, rating)}
            onViewPrompt={message.enhancedPromptSnapshot ? () => setShowPromptModal(true) : undefined}
          />
        )}

        {message.planSaved && !message.isStreaming && (
          <PlanReadyCard
            mode={message.mode as TaskMode}
            model={message.model}
            planPath={message.planPath}
            providerDetection={providerDetection}
            availableProviders={availableProviders}
            onApply={(provider, model) => getVsCodeApi().postMessage({
              type: 'applyPlan',
              mode: message.mode as TaskMode,
              model,
              planPath: message.planPath,
              provider,
            })}
            onEdit={() => getVsCodeApi().postMessage({
              type: 'openPlan',
              planPath: message.planPath,
            })}
            onOpenSavedPlans={() => getVsCodeApi().postMessage({
              type: 'openSavedPlans',
            })}
          />
        )}
      </div>

      {showPromptModal && message.enhancedPromptSnapshot && (
        <EnhancedPromptModal
          snapshot={message.enhancedPromptSnapshot}
          onClose={() => setShowPromptModal(false)}
        />
      )}
    </div>
  );
}, (prev, next) => {
  if (prev.message.id !== next.message.id) return false;
  if (prev.message.isStreaming !== next.message.isStreaming) return false;
  if (prev.message.isStreaming) return false; // always re-render while streaming
  if (prev.message.feedback !== next.message.feedback) return false;
  return true; // stable completed message — skip re-render
});
