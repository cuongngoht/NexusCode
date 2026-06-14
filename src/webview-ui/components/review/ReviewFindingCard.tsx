import React, { useState } from 'react';
import { Card, Button, Text, Badge } from '@fluentui/react-components';
import { ChevronDown16Regular, ChevronUp16Regular, DocumentRegular, CopyRegular, DocumentCopyRegular } from '@fluentui/react-icons';
import type { CodeReviewFinding } from '../../../application/code-review/CodeReviewFinding';
import { ReviewSeverityBadge } from './ReviewSeverityBadge';
import { ReviewCategoryBadge } from './ReviewCategoryBadge';
import { ReviewFixActions } from './ReviewFixActions';
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
    <Card style={{ marginBottom: '8px', padding: 0 }}>
      {/* Header */}
      <div
        style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        onClick={() => setExpanded(e => !e)}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setExpanded(ex => !ex); }}
        aria-expanded={expanded}
      >
        <ReviewSeverityBadge severity={finding.severity} />
        <ReviewCategoryBadge category={finding.category} />
        <Text weight="semibold" size={300} style={{ flex: 1 }}>{finding.title}</Text>
        {finding.blocking && (
          <Badge appearance="filled" color="danger" size="small">
            {t.codeReview.blocking}
          </Badge>
        )}
        {expanded ? <ChevronUp16Regular /> : <ChevronDown16Regular />}
      </div>

      {/* Location */}
      {locationLabel && (
        <div style={{ padding: '0 12px 4px' }}>
          <Text size={200} style={{ color: 'var(--vscode-descriptionForeground)', fontFamily: 'var(--vscode-editor-font-family)' }}>
            {locationLabel}
          </Text>
        </div>
      )}

      {/* Expanded body */}
      {expanded && (
        <div style={{ padding: '8px 12px 12px', borderTop: '1px solid var(--vscode-panel-border)' }}>
          <Text as="p" size={300} style={{ margin: '0 0 8px' }}>{finding.description}</Text>

          {finding.evidence && (
            <div style={{ marginBottom: '8px' }}>
              <Text size={200} weight="semibold" style={{ color: 'var(--vscode-descriptionForeground)', display: 'block', marginBottom: '4px' }}>
                {t.codeReview.evidence}
              </Text>
              <pre style={{ margin: 0, fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'var(--vscode-editor-font-family)', padding: '8px', background: 'var(--vscode-textCodeBlock-background)', borderRadius: '4px' }}>
                {finding.evidence}
              </pre>
            </div>
          )}

          {finding.whyItMatters && (
            <div style={{ marginBottom: '8px' }}>
              <Text size={200} weight="semibold" style={{ color: 'var(--vscode-descriptionForeground)', display: 'block', marginBottom: '4px' }}>
                {t.codeReview.whyItMatters}
              </Text>
              <Text size={300}>{finding.whyItMatters}</Text>
            </div>
          )}

          {finding.violatedPrinciple && (
            <div style={{ marginBottom: '8px' }}>
              <Text size={200} weight="semibold" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                {t.codeReview.violatedPrinciple}:{' '}
              </Text>
              <Text size={300}>{finding.violatedPrinciple}</Text>
            </div>
          )}

          <div style={{ marginBottom: '8px' }}>
            <Text size={200} weight="semibold" style={{ color: 'var(--vscode-descriptionForeground)', display: 'block', marginBottom: '4px' }}>
              {t.codeReview.recommendation}
            </Text>
            <Text size={300}>{finding.recommendation}</Text>
          </div>

          {finding.refactorRecommendation && (
            <div style={{ marginBottom: '8px' }}>
              <Text size={200} weight="semibold" style={{ color: 'var(--vscode-descriptionForeground)', display: 'block', marginBottom: '4px' }}>
                {t.codeReview.refactorRecommendation}
              </Text>
              <Text size={300}>{finding.refactorRecommendation}</Text>
            </div>
          )}

          {finding.suggestedPattern && (
            <div style={{ marginBottom: '8px' }}>
              <Text size={200} weight="semibold" style={{ color: 'var(--vscode-descriptionForeground)' }}>
                {t.codeReview.suggestedPattern}:{' '}
              </Text>
              <Text size={300}>{finding.suggestedPattern}</Text>
            </div>
          )}

          {(finding.migrationRisk || finding.priority) && (
            <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
              {finding.migrationRisk && (
                <Text size={200} style={{ color: 'var(--vscode-descriptionForeground)' }}>
                  {t.codeReview.migrationRisk}: <Text weight="semibold">{finding.migrationRisk}</Text>
                </Text>
              )}
              {finding.priority && (
                <Text size={200} style={{ color: 'var(--vscode-descriptionForeground)' }}>
                  {t.codeReview.priority}: <Text weight="semibold">{finding.priority}</Text>
                </Text>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
            {finding.filePath && (
              <Button
                appearance="subtle"
                size="small"
                icon={<DocumentRegular />}
                onClick={openFile}
              >
                {t.codeReview.openFile}
              </Button>
            )}
            <Button
              appearance="subtle"
              size="small"
              icon={<CopyRegular />}
              onClick={copyRecommendation}
            >
              {t.codeReview.copyRecommendation}
            </Button>
            {finding.suggestedPatch && (
              <Button
                appearance="subtle"
                size="small"
                icon={<DocumentCopyRegular />}
                onClick={copyPatch}
              >
                {t.codeReview.copyPatch}
              </Button>
            )}
          </div>
          <ReviewFixActions finding={finding} allowAutoFix={false} />
        </div>
      )}
    </Card>
  );
}
