import React from 'react';
import type { CodeReviewCategory } from '../../../application/code-review/CodeReviewCategory';
import { useT } from '../../i18n';

interface Props {
  category: CodeReviewCategory;
}

export function ReviewCategoryBadge({ category }: Props): React.ReactElement {
  const t = useT();
  const label = (t.codeReview.categories as Record<string, string>)[category] ?? category;

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 6px',
        borderRadius: '3px',
        fontSize: '11px',
        color: 'var(--vscode-badge-foreground)',
        background: 'var(--vscode-badge-background)',
        border: '1px solid var(--vscode-badge-background)',
      }}
    >
      {label}
    </span>
  );
}
