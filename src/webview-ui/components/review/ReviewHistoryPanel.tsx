import React from 'react';
import type { CodeReviewReport } from '../../../application/code-review/CodeReviewReport';
import { ReviewVerdictBadge } from './ReviewVerdictBadge';
import { useT } from '../../i18n';

interface Props {
  reports: CodeReviewReport[];
  activeReportId: string | null;
  onSelect: (report: CodeReviewReport) => void;
  onClearAll: () => void;
}

export function ReviewHistoryPanel({ reports, activeReportId, onSelect, onClearAll }: Props): React.ReactElement {
  const t = useT();
  const [confirmClear, setConfirmClear] = React.useState(false);

  if (reports.length === 0) {
    return (
      <div className="nx-review-history-panel nx-review-history-empty">
        <span>{t.codeReview.noHistory}</span>
      </div>
    );
  }

  return (
    <div className="nx-review-history-panel" role="listbox">
      <div className="nx-review-history-header">
        <span className="nx-review-history-title">{t.codeReview.historyTitle}</span>
        <button
          type="button"
          className="fl-iconbtn nx-review-history-clear"
          onClick={() => {
            if (confirmClear) { onClearAll(); setConfirmClear(false); }
            else setConfirmClear(true);
          }}
          onBlur={() => setConfirmClear(false)}
          title={confirmClear ? t.codeReview.confirmClear : t.codeReview.clearHistory}
        >
          {confirmClear ? '\u26A0 ' : ''}{t.codeReview.clearHistory}
        </button>
      </div>
      {reports.map(report => {
        const date = new Date(report.generatedAt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        const isActive = report.id === activeReportId;
        return (
          <div
            key={report.id}
            className={`nx-review-history-item${isActive ? ' nx-review-history-item-active' : ''}`}
            role="option"
            aria-selected={isActive}
            tabIndex={0}
            onClick={() => onSelect(report)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelect(report); }}
          >
            <div className="nx-review-history-item-row">
              <ReviewVerdictBadge verdict={report.verdict} type="review" />
              {report.architectureVerdict && (
                <ReviewVerdictBadge verdict={report.architectureVerdict} type="architecture" />
              )}
            </div>
            <div className="nx-review-history-item-meta">
              <span className="nx-review-history-branch">{report.baseBranch || 'main'}</span>
              <span className="nx-review-history-date">{date}</span>
              <span className="nx-review-history-count">
                {report.stats.totalFindings} {t.codeReview.findings}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
