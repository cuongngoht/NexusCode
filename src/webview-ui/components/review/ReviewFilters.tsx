import React from 'react';
import type { CodeReviewSeverity } from '../../../application/code-review/CodeReviewSeverity';
import type { CodeReviewCategory } from '../../../application/code-review/CodeReviewCategory';
import { useT } from '../../i18n';

interface Props {
  severityFilter: CodeReviewSeverity | 'all';
  categoryFilter: CodeReviewCategory | 'all';
  fileFilter: string | 'all';
  files: string[];
  onSeverityChange: (v: CodeReviewSeverity | 'all') => void;
  onCategoryChange: (v: CodeReviewCategory | 'all') => void;
  onFileChange: (v: string | 'all') => void;
}

const SEVERITIES: Array<CodeReviewSeverity | 'all'> = ['all', 'blocker', 'critical', 'major', 'minor', 'nit', 'info'];

export function ReviewFilters({ severityFilter, categoryFilter, fileFilter, files, onSeverityChange, onCategoryChange, onFileChange }: Props): React.ReactElement {
  const t = useT();

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'center' }}>
      <select
        value={severityFilter}
        onChange={e => onSeverityChange(e.target.value as CodeReviewSeverity | 'all')}
        style={{ fontSize: '12px', padding: '2px 6px', background: 'var(--vscode-dropdown-background)', color: 'var(--vscode-dropdown-foreground)', border: '1px solid var(--vscode-dropdown-border)', borderRadius: '3px' }}
        aria-label={t.codeReview.filterBySeverity}
      >
        {SEVERITIES.map(s => (
          <option key={s} value={s}>{s === 'all' ? t.codeReview.allSeverities : s}</option>
        ))}
      </select>

      <select
        value={categoryFilter}
        onChange={e => onCategoryChange(e.target.value as CodeReviewCategory | 'all')}
        style={{ fontSize: '12px', padding: '2px 6px', background: 'var(--vscode-dropdown-background)', color: 'var(--vscode-dropdown-foreground)', border: '1px solid var(--vscode-dropdown-border)', borderRadius: '3px' }}
        aria-label={t.codeReview.filterByCategory}
      >
        <option value="all">{t.codeReview.allCategories}</option>
        <option value="bug">Bug</option>
        <option value="security">Security</option>
        <option value="architecture">Architecture</option>
        <option value="oop">OOP</option>
        <option value="ood">OOD</option>
        <option value="design-pattern">Design Pattern</option>
        <option value="coupling">Coupling</option>
        <option value="cohesion">Cohesion</option>
        <option value="maintainability">Maintainability</option>
        <option value="performance">Performance</option>
        <option value="test">Test</option>
        <option value="style">Style</option>
      </select>

      {files.length > 0 && (
        <select
          value={fileFilter}
          onChange={e => onFileChange(e.target.value)}
          style={{ fontSize: '12px', padding: '2px 6px', background: 'var(--vscode-dropdown-background)', color: 'var(--vscode-dropdown-foreground)', border: '1px solid var(--vscode-dropdown-border)', borderRadius: '3px', maxWidth: '200px' }}
          aria-label={t.codeReview.filterByFile}
        >
          <option value="all">{t.codeReview.allFiles}</option>
          {files.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      )}
    </div>
  );
}
