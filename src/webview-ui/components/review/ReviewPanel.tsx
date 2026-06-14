import React, { useState } from 'react';
import type { CodeReviewReport } from '../../../application/code-review/CodeReviewReport';
import { ReviewSummaryCard } from './ReviewSummaryCard';
import { ReviewFindingList } from './ReviewFindingList';
import { ReviewFileTree } from './ReviewFileTree';
import { useT } from '../../i18n';
import { getVsCodeApi } from '../../vscodeApi';

interface Props {
  report: CodeReviewReport;
}

type Tab = 'findings' | 'files' | 'summary';

export function ReviewPanel({ report }: Props): React.ReactElement {
  const t = useT();
  const [activeTab, setActiveTab] = useState<Tab>('findings');

  function exportReport(): void {
    getVsCodeApi().postMessage({ type: 'exportCodeReviewReport', reportId: report.id });
  }

  const tabStyle = (tab: Tab): React.CSSProperties => ({
    padding: '4px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    borderBottom: activeTab === tab ? '2px solid var(--vscode-focusBorder)' : '2px solid transparent',
    color: activeTab === tab ? 'var(--vscode-foreground)' : 'var(--vscode-descriptionForeground)',
    background: 'none',
    border: 'none',
    borderBottom: activeTab === tab ? '2px solid var(--vscode-focusBorder)' : '2px solid transparent',
    fontWeight: activeTab === tab ? 600 : 400,
  } as React.CSSProperties);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--vscode-editorWidget-border)', marginBottom: '8px' }}>
        <span style={{ fontWeight: 700, fontSize: '14px' }}>{t.codeReview.panelTitle}</span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={exportReport} className="nexus-btn" style={{ fontSize: '12px', padding: '2px 8px', cursor: 'pointer' }}>
            {t.codeReview.exportReport}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--vscode-editorWidget-border)', marginBottom: '12px' }}>
        <button style={tabStyle('summary')} onClick={() => setActiveTab('summary')}>
          {t.codeReview.tabSummary}
        </button>
        <button style={tabStyle('findings')} onClick={() => setActiveTab('findings')}>
          {t.codeReview.tabFindings} ({report.findings.length})
        </button>
        <button style={tabStyle('files')} onClick={() => setActiveTab('files')}>
          {t.codeReview.tabFiles} ({report.changedFiles.length})
        </button>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'summary' && (
          <ReviewSummaryCard report={report} />
        )}
        {activeTab === 'findings' && (
          <ReviewFindingList findings={report.findings} />
        )}
        {activeTab === 'files' && (
          <ReviewFileTree report={report} />
        )}
      </div>
    </div>
  );
}
