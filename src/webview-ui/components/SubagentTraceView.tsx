import { memo } from 'react';
import type { SubagentTraceState, SubagentTraceItem } from '../messages';
import { useT, interp } from '../i18n';

interface Props {
  trace: SubagentTraceState;
}

function StatusIcon({ status }: { status: SubagentTraceItem['status'] }) {
  if (status === 'running') {
    return <span className="nx-subagent-trace-status fl-spinner" />;
  }
  if (status === 'completed') {
    return <span className="nx-subagent-trace-status">✓</span>;
  }
  if (status === 'failed') {
    return <span className="nx-subagent-trace-status">✗</span>;
  }
  // pending
  return <span className="nx-subagent-trace-status">⏳</span>;
}

function SubagentTraceItemRow({ item }: { item: SubagentTraceItem }) {
  const t = useT();
  const st = t.subagentTrace;

  let metaText = '';
  if (item.status === 'running') {
    metaText = st.running;
  } else if (item.status === 'pending') {
    metaText = st.waiting;
  } else if (item.status === 'failed') {
    metaText = item.error ?? st.failed;
  } else if (item.status === 'completed') {
    const parts: string[] = [];
    if (item.durationMs !== undefined) {
      parts.push(`${(item.durationMs / 1000).toFixed(1)}s`);
    }
    if (item.findingCount !== undefined) {
      parts.push(interp(st.findingsCount, { count: String(item.findingCount) }));
    }
    if (item.confidence !== undefined) {
      parts.push(interp(st.confidence, { value: String(item.confidence) }));
    }
    metaText = parts.join(' · ') || st.completed;
  }

  return (
    <div className={`nx-subagent-trace-item nx-subagent-trace-item--${item.status}`}>
      <StatusIcon status={item.status} />
      <span className="nx-subagent-trace-name">{item.displayName ?? item.role}</span>
      {metaText && <span className="nx-subagent-trace-meta">{metaText}</span>}
    </div>
  );
}

export const SubagentTraceView = memo(function SubagentTraceView({ trace }: Props) {
  const t = useT();

  if (!trace || trace.items.length === 0) return null;

  return (
    <div className="nx-subagent-trace" aria-label={t.subagentTrace.title}>
      <div className="nx-subagent-trace-title">{t.subagentTrace.title}</div>
      {trace.items.map(item => (
        <SubagentTraceItemRow key={item.role} item={item} />
      ))}
    </div>
  );
});
