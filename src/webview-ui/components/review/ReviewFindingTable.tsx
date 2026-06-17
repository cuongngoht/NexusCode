import React, { useMemo, useState } from 'react';
import { Text, Badge } from '@fluentui/react-components';
import { ChevronDown16Regular, ChevronUp16Regular } from '@fluentui/react-icons';
import type { CodeReviewFinding } from '../../../application/code-review/CodeReviewFinding';
import type { CodeReviewSeverity } from '../../../application/code-review/CodeReviewSeverity';
import type { CodeReviewCategory } from '../../../application/code-review/CodeReviewCategory';
import { ReviewFilters } from './ReviewFilters';
import { ReviewSeverityBadge } from './ReviewSeverityBadge';
import { ReviewCategoryBadge } from './ReviewCategoryBadge';
import { ReviewFindingCard } from './ReviewFindingCard';
import { useT } from '../../i18n';

interface Props {
  findings: CodeReviewFinding[];
}

const SEVERITY_ORDER: Record<CodeReviewSeverity, number> = {
  blocker: 0, critical: 1, major: 2, minor: 3, nit: 4, info: 5,
};

const SEVERITY_BORDER: Record<CodeReviewSeverity, string> = {
  blocker:  'var(--vscode-errorForeground)',
  critical: 'var(--vscode-editorError-foreground, #fd7e14)',
  major:    'var(--vscode-editorWarning-foreground)',
  minor:    'var(--vscode-editorInfo-foreground)',
  nit:      'var(--vscode-descriptionForeground)',
  info:     'var(--vscode-textLink-foreground)',
};

export function ReviewFindingTable({ findings }: Props): React.ReactElement {
  const t = useT();
  const s = t.codeReview;

  const [severityFilter, setSeverityFilter] = useState<CodeReviewSeverity | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<CodeReviewCategory | 'all'>('all');
  const [fileFilter, setFileFilter] = useState<string | 'all'>('all');
  const [searchText, setSearchText] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const files = useMemo(() => {
    const unique = new Set(findings.map(f => f.filePath).filter((p): p is string => Boolean(p)));
    return [...unique].sort();
  }, [findings]);

  const sorted = useMemo(() =>
    [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]),
  [findings]);

  const filtered = useMemo(() => {
    const search = searchText.toLowerCase();
    return sorted.filter(f => {
      if (severityFilter !== 'all' && f.severity !== severityFilter) return false;
      if (categoryFilter !== 'all' && f.category !== categoryFilter) return false;
      if (fileFilter !== 'all' && f.filePath !== fileFilter) return false;
      if (search && !f.title.toLowerCase().includes(search) && !f.description.toLowerCase().includes(search)) return false;
      return true;
    });
  }, [sorted, severityFilter, categoryFilter, fileFilter, searchText]);

  return (
    <div>
      <ReviewFilters
        severityFilter={severityFilter}
        categoryFilter={categoryFilter}
        fileFilter={fileFilter}
        searchText={searchText}
        files={files}
        onSeverityChange={setSeverityFilter}
        onCategoryChange={setCategoryFilter}
        onFileChange={setFileFilter}
        onSearchChange={setSearchText}
      />

      {filtered.length === 0 ? (
        <Text size={300} style={{ color: 'var(--vscode-descriptionForeground)', padding: '16px 0', display: 'block' }}>
          {s.noFindings}
        </Text>
      ) : (
        <div style={{ border: '1px solid var(--vscode-panel-border)', borderRadius: '6px', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '90px 100px 1fr auto 24px',
            gap: '8px',
            padding: '6px 12px',
            background: 'var(--vscode-sideBarSectionHeader-background)',
            borderBottom: '1px solid var(--vscode-panel-border)',
          }}>
            <Text size={100} weight="semibold" style={{ color: 'var(--vscode-descriptionForeground)', textTransform: 'uppercase' }}>{s.colSeverity}</Text>
            <Text size={100} weight="semibold" style={{ color: 'var(--vscode-descriptionForeground)', textTransform: 'uppercase' }}>{s.colCategory}</Text>
            <Text size={100} weight="semibold" style={{ color: 'var(--vscode-descriptionForeground)', textTransform: 'uppercase' }}>{s.colTitle}</Text>
            <Text size={100} weight="semibold" style={{ color: 'var(--vscode-descriptionForeground)', textTransform: 'uppercase' }}>{s.colLocation}</Text>
            <span />
          </div>

          {/* Table rows */}
          {filtered.map((finding, idx) => {
            const isExpanded = expandedId === finding.id;
            const isLast = idx === filtered.length - 1;
            const location = finding.filePath
              ? `${finding.filePath.split('/').pop()}${finding.lineStart !== undefined ? `:${finding.lineStart}` : ''}`
              : null;

            return (
              <div
                key={finding.id}
                style={{ borderBottom: isLast ? 'none' : '1px solid var(--vscode-panel-border)' }}
              >
                {/* Row */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onClick={() => setExpandedId(isExpanded ? null : finding.id)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setExpandedId(isExpanded ? null : finding.id); }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '90px 100px 1fr auto 24px',
                    gap: '8px',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    alignItems: 'center',
                    borderLeft: `3px solid ${SEVERITY_BORDER[finding.severity]}`,
                    background: isExpanded
                      ? 'var(--vscode-list-activeSelectionBackground, rgba(255,255,255,0.05))'
                      : 'transparent',
                  }}
                >
                  <ReviewSeverityBadge severity={finding.severity} />
                  <ReviewCategoryBadge category={finding.category} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    <Text size={200} weight="semibold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {finding.title}
                    </Text>
                    {finding.blocking && (
                      <Badge appearance="filled" color="danger" size="small" style={{ flexShrink: 0 }}>
                        {s.blocking}
                      </Badge>
                    )}
                  </div>
                  <Text
                    size={100}
                    style={{
                      color: 'var(--vscode-descriptionForeground)',
                      fontFamily: 'var(--vscode-editor-font-family)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '160px',
                    }}
                    title={location ?? ''}
                  >
                    {location ?? '—'}
                  </Text>
                  {isExpanded ? <ChevronUp16Regular /> : <ChevronDown16Regular />}
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{
                    borderTop: '1px solid var(--vscode-panel-border)',
                    background: 'var(--vscode-editorWidget-background)',
                    padding: '4px 8px 4px 16px',
                  }}>
                    <ReviewFindingCard finding={finding} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
