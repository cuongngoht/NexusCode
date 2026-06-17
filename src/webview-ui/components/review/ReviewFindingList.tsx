import React, { useMemo, useState } from 'react';
import { Text } from '@fluentui/react-components';
import type { CodeReviewFinding } from '../../../application/code-review/CodeReviewFinding';
import type { CodeReviewSeverity } from '../../../application/code-review/CodeReviewSeverity';
import type { CodeReviewCategory } from '../../../application/code-review/CodeReviewCategory';
import { ReviewFindingCard } from './ReviewFindingCard';
import { ReviewFilters } from './ReviewFilters';
import { useT } from '../../i18n';

interface Props {
  findings: CodeReviewFinding[];
}

export function ReviewFindingList({ findings }: Props): React.ReactElement {
  const t = useT();
  const [severityFilter, setSeverityFilter] = useState<CodeReviewSeverity | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<CodeReviewCategory | 'all'>('all');
  const [fileFilter, setFileFilter] = useState<string | 'all'>('all');
  const [searchText, setSearchText] = useState('');

  const files = useMemo(() => {
    const unique = new Set(findings.map(f => f.filePath).filter((p): p is string => Boolean(p)));
    return [...unique].sort();
  }, [findings]);

  const filtered = useMemo(() => {
    const search = searchText.toLowerCase();
    return findings.filter(f => {
      if (severityFilter !== 'all' && f.severity !== severityFilter) return false;
      if (categoryFilter !== 'all' && f.category !== categoryFilter) return false;
      if (fileFilter !== 'all' && f.filePath !== fileFilter) return false;
      if (search && !f.title.toLowerCase().includes(search) && !f.description.toLowerCase().includes(search)) return false;
      return true;
    });
  }, [findings, severityFilter, categoryFilter, fileFilter, searchText]);

  const grouped = useMemo(() => {
    const noFile: CodeReviewFinding[] = [];
    const byFile = new Map<string, CodeReviewFinding[]>();
    for (const f of filtered) {
      if (!f.filePath) {
        noFile.push(f);
      } else {
        if (!byFile.has(f.filePath)) byFile.set(f.filePath, []);
        byFile.get(f.filePath)!.push(f);
      }
    }
    return { noFile, byFile };
  }, [filtered]);

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

      {grouped.noFile.map(f => <ReviewFindingCard key={f.id} finding={f} />)}

      {[...grouped.byFile.entries()].map(([file, fileFindings]) => (
        <div key={file} style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--vscode-descriptionForeground)', marginBottom: '6px', fontFamily: 'var(--vscode-editor-font-family)', padding: '4px 8px', background: 'var(--vscode-sideBar-background)', borderRadius: '4px' }}>
            {file} <span style={{ fontWeight: 400 }}>({fileFindings.length})</span>
          </div>
          {fileFindings.map(f => <ReviewFindingCard key={f.id} finding={f} />)}
        </div>
      ))}

      {filtered.length === 0 && (
        <Text size={300} style={{ color: 'var(--vscode-descriptionForeground)', padding: '16px 0', display: 'block' }}>
          {t.codeReview.noFindings}
        </Text>
      )}
    </div>
  );
}
