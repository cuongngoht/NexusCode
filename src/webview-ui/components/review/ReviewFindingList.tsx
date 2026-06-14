import React, { useMemo, useState } from 'react';
import type { CodeReviewFinding } from '../../../application/code-review/CodeReviewFinding';
import type { CodeReviewSeverity } from '../../../application/code-review/CodeReviewSeverity';
import type { CodeReviewCategory } from '../../../application/code-review/CodeReviewCategory';
import { ReviewFindingCard } from './ReviewFindingCard';
import { ReviewFilters } from './ReviewFilters';

interface Props {
  findings: CodeReviewFinding[];
}

export function ReviewFindingList({ findings }: Props): React.ReactElement {
  const [severityFilter, setSeverityFilter] = useState<CodeReviewSeverity | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<CodeReviewCategory | 'all'>('all');
  const [fileFilter, setFileFilter] = useState<string | 'all'>('all');

  const files = useMemo(() => {
    const unique = new Set(findings.map(f => f.filePath).filter((p): p is string => Boolean(p)));
    return [...unique].sort();
  }, [findings]);

  const filtered = useMemo(() => {
    return findings.filter(f => {
      if (severityFilter !== 'all' && f.severity !== severityFilter) return false;
      if (categoryFilter !== 'all' && f.category !== categoryFilter) return false;
      if (fileFilter !== 'all' && f.filePath !== fileFilter) return false;
      return true;
    });
  }, [findings, severityFilter, categoryFilter, fileFilter]);

  // Group by file
  const grouped = useMemo(() => {
    const noFile: CodeReviewFinding[] = [];
    const byFile: Map<string, CodeReviewFinding[]> = new Map();
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
        files={files}
        onSeverityChange={setSeverityFilter}
        onCategoryChange={setCategoryFilter}
        onFileChange={setFileFilter}
      />

      {/* No file group */}
      {grouped.noFile.map(f => (
        <ReviewFindingCard key={f.id} finding={f} />
      ))}

      {/* Per-file groups */}
      {[...grouped.byFile.entries()].map(([file, filFindings]) => (
        <div key={file} style={{ marginBottom: '16px' }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--vscode-descriptionForeground)',
            marginBottom: '6px',
            fontFamily: 'var(--vscode-editor-font-family)',
            padding: '4px 8px',
            background: 'var(--vscode-sideBar-background)',
            borderRadius: '4px',
          }}>
            {file} <span style={{ fontWeight: 400 }}>({filFindings.length})</span>
          </div>
          {filFindings.map(f => (
            <ReviewFindingCard key={f.id} finding={f} />
          ))}
        </div>
      ))}

      {filtered.length === 0 && (
        <div style={{ color: 'var(--vscode-descriptionForeground)', fontSize: '13px', padding: '16px 0' }}>
          No findings match the current filters.
        </div>
      )}
    </div>
  );
}
