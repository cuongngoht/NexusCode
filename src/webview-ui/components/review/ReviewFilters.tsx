import React from 'react';
import { Dropdown, Option, Input } from '@fluentui/react-components';
import { Search24Regular } from '@fluentui/react-icons';
import type { CodeReviewSeverity } from '../../../application/code-review/CodeReviewSeverity';
import type { CodeReviewCategory } from '../../../application/code-review/CodeReviewCategory';
import { useT } from '../../i18n';

interface Props {
  severityFilter: CodeReviewSeverity | 'all';
  categoryFilter: CodeReviewCategory | 'all';
  fileFilter: string | 'all';
  searchText: string;
  files: string[];
  onSeverityChange: (v: CodeReviewSeverity | 'all') => void;
  onCategoryChange: (v: CodeReviewCategory | 'all') => void;
  onFileChange: (v: string | 'all') => void;
  onSearchChange: (v: string) => void;
}

const SEVERITIES: Array<CodeReviewSeverity | 'all'> = ['all', 'blocker', 'critical', 'major', 'minor', 'nit', 'info'];
const CATEGORIES: Array<{ value: CodeReviewCategory | 'all'; label: string }> = [
  { value: 'all', label: 'All Categories' },
  { value: 'bug', label: 'Bug' },
  { value: 'security', label: 'Security' },
  { value: 'performance', label: 'Performance' },
  { value: 'test', label: 'Test' },
  { value: 'maintainability', label: 'Maintainability' },
  { value: 'complexity', label: 'Complexity' },
  { value: 'technical-debt', label: 'Technical Debt' },
  { value: 'style', label: 'Style' },
  { value: 'docs', label: 'Docs' },
  { value: 'typing', label: 'Typing' },
  { value: 'dependency', label: 'Dependency' },
  { value: 'config', label: 'Config' },
  { value: 'ux', label: 'UX' },
];

export function ReviewFilters({
  severityFilter, categoryFilter, fileFilter, searchText,
  files, onSeverityChange, onCategoryChange, onFileChange, onSearchChange,
}: Props): React.ReactElement {
  const t = useT();
  const s = t.codeReview;

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'center' }}>
      <Input
        size="small"
        placeholder={s.searchPlaceholder}
        value={searchText}
        onChange={(_, d) => onSearchChange(d.value)}
        contentBefore={<Search24Regular style={{ fontSize: '14px' }} />}
        style={{ minWidth: '160px' }}
      />

      <Dropdown
        size="small"
        value={severityFilter === 'all' ? s.allSeverities : severityFilter}
        selectedOptions={[severityFilter]}
        onOptionSelect={(_, d) => onSeverityChange(d.optionValue as CodeReviewSeverity | 'all')}
        aria-label={s.filterBySeverity}
        style={{ minWidth: '120px' }}
      >
        {SEVERITIES.map(sv => (
          <Option key={sv} value={sv}>{sv === 'all' ? s.allSeverities : sv}</Option>
        ))}
      </Dropdown>

      <Dropdown
        size="small"
        value={categoryFilter === 'all' ? s.allCategories : categoryFilter}
        selectedOptions={[categoryFilter]}
        onOptionSelect={(_, d) => onCategoryChange(d.optionValue as CodeReviewCategory | 'all')}
        aria-label={s.filterByCategory}
        style={{ minWidth: '140px' }}
      >
        {CATEGORIES.map(c => (
          <Option key={c.value} value={c.value}>{c.label}</Option>
        ))}
      </Dropdown>

      {files.length > 0 && (
        <Dropdown
          size="small"
          value={fileFilter === 'all' ? s.allFiles : fileFilter}
          selectedOptions={[fileFilter]}
          onOptionSelect={(_, d) => onFileChange(d.optionValue as string)}
          aria-label={s.filterByFile}
          style={{ minWidth: '160px', maxWidth: '240px' }}
        >
          <Option value="all">{s.allFiles}</Option>
          {files.map(f => (
            <Option key={f} value={f}>{f}</Option>
          ))}
        </Dropdown>
      )}
    </div>
  );
}
