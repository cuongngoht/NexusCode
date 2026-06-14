import React, { useState } from 'react';
import type { CodeReviewFinding } from '../../../application/code-review/CodeReviewFinding';
import { ReviewSeverityBadge } from './ReviewSeverityBadge';
import { ReviewCategoryBadge } from './ReviewCategoryBadge';
import { useT } from '../../i18n';
import { getVsCodeApi } from '../../vscodeApi';

interface Props {
  finding: CodeReviewFinding;
}

export function ReviewFindingCard({ finding }: Props): React.ReactElement {
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  function openFile(): void {
    if (!finding.filePath) return;
    getVsCodeApi().postMessage({
      type: 'openFileFromDiff',
      path: finding.filePath,
      line: finding.lineStart,
    });
  }

  function copyRecommendation(): void {
    const text = finding.refactorRecommendation ?? finding.recommendation;
    navigator.clipboard?.writeText(text).catch(() => undefined);
  }

  function copyPatch(): void {
    if (!finding.suggestedPatch) return;
    navigator.clipboard?.writeText(finding.suggestedPatch).catch(() => undefined);
  }

  const locationLabel = finding.filePath
    ? `${finding.filePath}${finding.lineStart !== undefined ? `:${finding.lineStart}` : ''}`
    : null;

  return (
    <div style={{
      border: '1px solid var(--vscode-editorWidget-border)',
      borderRadius: '6px',
      marginBottom: '8px',
      background: 'var(--vscode-editorWidget-background)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '8px' }}
        onClick={() => setExpanded(e => !e)}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setExpanded(ex => !ex); }}
        aria-expanded={expanded}
      >
        <ReviewSeverityBadge severity={finding.severity} />
        <ReviewCategoryBadge category={finding.category} />
        <span style={{ flex: 1, fontWeight: 500, fontSize: '13px' }}>{finding.title}</span>
        {finding.blocking && (
          <span style={{ fontSize: '11px', color: 'var(--vscode-errorForeground)', fontWeight: 600 }}>
            {t.codeReview.blocking}
          </span>
        )}
        <span style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Location */}
      {locationLabel && (
        <div style={{ padding: '0 12px 4px', fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
          {locationLabel}
        </div>
      )}

      {/* Expanded body */}
      {expanded && (
        <div style={{ padding: '8px 12px 12px', borderTop: '1px solid var(--vscode-editorWidget-border)' }}>
          <p style={{ margin: '0 0 8px', fontSize: '13px' }}>{finding.description}</p>

          {finding.evidence && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--vscode-descriptionForeground)', marginBottom: '2px' }}>
                {t.codeReview.evidence}
              </div>
              <pre style={{ margin: 0, fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'var(--vscode-editor-font-family)' }}>
                {finding.evidence}
              </pre>
            </div>
          )}

          {finding.whyItMatters && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--vscode-descriptionForeground)', marginBottom: '2px' }}>
                {t.codeReview.whyItMatters}
              </div>
              <p style={{ margin: 0, fontSize: '13px' }}>{finding.whyItMatters}</p>
            </div>
          )}

          {finding.violatedPrinciple && (
            <div style={{ marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--vscode-descriptionForeground)' }}>
                {t.codeReview.violatedPrinciple}:{' '}
              </span>
              <span style={{ fontSize: '13px' }}>{finding.violatedPrinciple}</span>
            </div>
          )}

          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--vscode-descriptionForeground)', marginBottom: '2px' }}>
              {t.codeReview.recommendation}
            </div>
            <p style={{ margin: 0, fontSize: '13px' }}>{finding.recommendation}</p>
          </div>

          {finding.refactorRecommendation && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--vscode-descriptionForeground)', marginBottom: '2px' }}>
                {t.codeReview.refactorRecommendation}
              </div>
              <p style={{ margin: 0, fontSize: '13px' }}>{finding.refactorRecommendation}</p>
            </div>
          )}

          {finding.suggestedPattern && (
            <div style={{ marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--vscode-descriptionForeground)' }}>
                {t.codeReview.suggestedPattern}:{' '}
              </span>
              <span style={{ fontSize: '13px' }}>{finding.suggestedPattern}</span>
            </div>
          )}

          {(finding.migrationRisk || finding.priority) && (
            <div style={{ display: 'flex', gap: '12px', marginBottom: '8px', fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
              {finding.migrationRisk && (
                <span>{t.codeReview.migrationRisk}: <strong>{finding.migrationRisk}</strong></span>
              )}
              {finding.priority && (
                <span>{t.codeReview.priority}: <strong>{finding.priority}</strong></span>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
            {finding.filePath && (
              <button
                onClick={openFile}
                style={{ fontSize: '12px', padding: '2px 8px', cursor: 'pointer' }}
                className="nexus-btn"
              >
                {t.codeReview.openFile}
              </button>
            )}
            <button
              onClick={copyRecommendation}
              style={{ fontSize: '12px', padding: '2px 8px', cursor: 'pointer' }}
              className="nexus-btn"
            >
              {t.codeReview.copyRecommendation}
            </button>
            {finding.suggestedPatch && (
              <button
                onClick={copyPatch}
                style={{ fontSize: '12px', padding: '2px 8px', cursor: 'pointer' }}
                className="nexus-btn"
              >
                {t.codeReview.copyPatch}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
