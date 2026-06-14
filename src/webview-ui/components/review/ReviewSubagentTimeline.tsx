import React from 'react';
import { Badge, Text, ProgressBar, Divider, Spinner } from '@fluentui/react-components';
import { CheckmarkCircle16Filled, ErrorCircle16Filled, Circle16Regular } from '@fluentui/react-icons';
import { useT } from '../../i18n';

interface SubagentTraceItem {
  role: string;
  displayName?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  durationMs?: number;
  confidence?: number;
  findingCount?: number;
  error?: string;
}

interface SubagentTraceState {
  runId: string;
  items: SubagentTraceItem[];
}

interface Props {
  trace: SubagentTraceState;
  synthesis?: { topFindings: number; files: string[]; risks: string[]; confidence: number } | null;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StatusIcon({ status }: { status: SubagentTraceItem['status'] }): React.ReactElement {
  if (status === 'completed') return <CheckmarkCircle16Filled style={{ color: 'var(--colorPaletteGreenForeground1)' }} />;
  if (status === 'failed') return <ErrorCircle16Filled style={{ color: 'var(--colorPaletteRedForeground1)' }} />;
  if (status === 'running') return <Spinner size="extra-tiny" />;
  return <Circle16Regular style={{ color: 'var(--vscode-descriptionForeground)' }} />;
}

export function ReviewSubagentTimeline({ trace, synthesis }: Props): React.ReactElement {
  const t = useT();
  const s = t.codeReview;
  const completedCount = trace.items.filter(i => i.status === 'completed').length;

  return (
    <div style={{ marginBottom: '16px', padding: '12px 14px', background: 'var(--vscode-editorWidget-background)', borderRadius: '6px', border: '1px solid var(--vscode-panel-border)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <Text weight="semibold" size={300}>{s.subagentSection}</Text>
        <Badge appearance="tint" color="brand" size="small">{completedCount}/{trace.items.length}</Badge>
      </div>

      {/* Agent rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {trace.items.map(item => (
          <div key={item.role} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px', borderRadius: '4px', background: 'var(--vscode-editor-background)' }}>
            <StatusIcon status={item.status} />
            <Text size={300} style={{ flex: 1 }}>{item.displayName ?? item.role}</Text>
            {item.status === 'completed' && (
              <>
                {item.findingCount !== undefined && (
                  <Badge appearance="outline" color="informative" size="small">{item.findingCount} findings</Badge>
                )}
                {item.confidence !== undefined && (
                  <Text size={200} style={{ color: 'var(--vscode-descriptionForeground)' }}>{Math.round(item.confidence * 100)}%</Text>
                )}
                {item.durationMs !== undefined && (
                  <Text size={200} style={{ color: 'var(--vscode-descriptionForeground)' }}>{formatDuration(item.durationMs)}</Text>
                )}
              </>
            )}
            {item.status === 'failed' && (
              <Text size={200} style={{ color: 'var(--colorPaletteRedForeground1)' }}>{item.error ?? 'Failed'}</Text>
            )}
          </div>
        ))}
      </div>

      {/* Synthesis summary */}
      {synthesis && (
        <>
          <Divider style={{ margin: '10px 0' }} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Text size={200} style={{ color: 'var(--vscode-descriptionForeground)' }}>{s.subagentTopFindings}:</Text>
              <Badge appearance="filled" color="informative" size="small">{synthesis.topFindings}</Badge>
            </div>
            {synthesis.risks.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Text size={200} style={{ color: 'var(--vscode-descriptionForeground)' }}>{s.subagentRisks}:</Text>
                <Badge appearance="filled" color="warning" size="small">{synthesis.risks.length}</Badge>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '140px' }}>
              <Text size={200} style={{ color: 'var(--vscode-descriptionForeground)' }}>{s.subagentConfidence}:</Text>
              <ProgressBar value={synthesis.confidence} style={{ flex: 1 }} thickness="medium" />
              <Text size={200}>{Math.round(synthesis.confidence * 100)}%</Text>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
