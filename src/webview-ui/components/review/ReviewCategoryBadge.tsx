import React from 'react';
import { Badge } from '@fluentui/react-components';
import type { CodeReviewCategory } from '../../../application/code-review/CodeReviewCategory';
import { useT } from '../../i18n';

interface Props {
  category: CodeReviewCategory;
}

export function ReviewCategoryBadge({ category }: Props): React.ReactElement {
  const t = useT();
  const label = (t.codeReview.categories as Record<string, string>)[category] ?? category;

  return (
    <Badge
      appearance="tint"
      color="brand"
      size="extra-small"
      shape="rounded"
    >
      {label}
    </Badge>
  );
}
