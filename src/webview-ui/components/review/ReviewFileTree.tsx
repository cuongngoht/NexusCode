import React from 'react';
import { Text } from '@fluentui/react-components';
import type { CodeReviewReport } from '../../../application/code-review/CodeReviewReport';
import { useT } from '../../i18n';
import { getVsCodeApi } from '../../vscodeApi';

interface Props {
  report: CodeReviewReport;
}

export function ReviewFileTree({ report }: Props): React.ReactElement {
  const t = useT();

  if (report.changedFiles.length === 0) {
    return <Text size={300} style={{ color: 'var(--vscode-descriptionForeground)' }}>{t.codeReview.noChangedFiles}</Text>;
  }

  function openFile(path: string): void {
    getVsCodeApi().postMessage({ type: 'openReviewFinding', findingId: '', filePath: path });
  }

  return (
    <div style={{ marginBottom: '12px' }}>
      <Text size={200} weight="semibold" style={{ color: 'var(--vscode-descriptionForeground)', display: 'block', marginBottom: '6px' }}>
        {t.codeReview.changedFiles} ({report.changedFiles.length})
      </Text>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {report.changedFiles.map(f => (
          <div
            key={f.path}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 6px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'var(--vscode-editor-font-family)' }}
            onClick={() => openFile(f.path)}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--vscode-list-hoverBackground)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openFile(f.path); }}
          >
            <Text
              size={100}
              weight="semibold"
              style={{
                width: '14px',
                textAlign: 'center',
                color: f.status === 'A' ? 'var(--vscode-gitDecoration-addedResourceForeground)'
                  : f.status === 'D' ? 'var(--vscode-gitDecoration-deletedResourceForeground)'
                  : 'var(--vscode-gitDecoration-modifiedResourceForeground)',
              }}
            >
              {f.status}
            </Text>
            <Text size={200} style={{ flex: 1, color: 'var(--vscode-foreground)' }}>{f.path}</Text>
            {(f.additions !== undefined || f.deletions !== undefined) && (
              <div style={{ display: 'flex', gap: '4px' }}>
                {f.additions !== undefined && (
                  <Text size={100} style={{ color: 'var(--vscode-gitDecoration-addedResourceForeground)' }}>+{f.additions}</Text>
                )}
                {f.deletions !== undefined && (
                  <Text size={100} style={{ color: 'var(--vscode-gitDecoration-deletedResourceForeground)' }}>-{f.deletions}</Text>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
