import React from 'react';
import type { SubagentTraceState } from '../messages';

interface SubagentTracePanelProps {
  trace: SubagentTraceState;
}

function statusIcon(status: string): string {
  switch (status) {
    case 'completed': return '✓';
    case 'failed': return '⚠';
    case 'running': return '⟳';
    default: return '·';
  }
}

function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function SubagentTracePanel({ trace }: SubagentTracePanelProps): React.ReactElement | null {
  if (!trace || trace.items.length === 0) return null;

  return (
    <div className="subagent-trace-panel" aria-label="Subagent trace">
      <div className="subagent-trace-header">
        <span className="subagent-trace-label">Subagents</span>
      </div>
      <div className="subagent-trace-items">
        {trace.items.map(item => (
          <div
            key={item.role}
            className={`subagent-trace-item subagent-trace-item--${item.status}`}
            title={item.error ?? ''}
          >
            <span className="subagent-trace-icon">{statusIcon(item.status)}</span>
            <span className="subagent-trace-role">{item.displayName ?? item.role}</span>
            {item.durationMs !== undefined && (
              <span className="subagent-trace-duration">{formatDuration(item.durationMs)}</span>
            )}
            {item.agentId && (
              <span className="subagent-trace-agent">{item.agentId}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
