import React from 'react';
import type { CodeReviewReport } from '../../../application/code-review/CodeReviewReport';
import { useT } from '../../i18n';

interface Props {
  report: CodeReviewReport;
}

export function ReviewFileTree({ report }: Props): React.ReactElement {
  const t = useT();

  if (report.changedFiles.length === 0) {
    return <div style={{ fontSize: '13px', color: 'var(--vscode-descriptionForeground)' }}>{t.codeReview.noChangedFiles}</div>;
  }

  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--vscode-descriptionForeground)', marginBottom: '6px' }}>
        {t.codeReview.changedFiles} ({report.changedFiles.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {report.changedFiles.map(f => (
          <div key={f.path} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', padding: '2px 4px', fontFamily: 'var(--vscode-editor-font-family)' }}>
            <span style={{
              fontSize: '10px', fontWeight: 600, width: '16px', textAlign: 'center',
              color: f.status === 'A' ? 'var(--vscode-gitDecoration-addedResourceForeground)'
                : f.status === 'D' ? 'var(--vscode-gitDecoration-deletedResourceForeground)'
                : 'var(--vscode-gitDecoration-modifiedResourceForeground)',
            }}>
              {f.status}
            </span>
            <span>{f.path}</span>
            {(f.additions !== undefined || f.deletions !== undefined) && (
              <span style={{ color: 'var(--vscode-descriptionForeground)', marginLeft: 'auto' }}>
                {f.additions !== undefined && <span style={{ color: 'var(--vscode-gitDecoration-addedResourceForeground)' }}>+{f.additions}</span>}
                {f.deletions !== undefined && <span style={{ color: 'var(--vscode-gitDecoration-deletedResourceForeground)' }}> -{f.deletions}</span>}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
