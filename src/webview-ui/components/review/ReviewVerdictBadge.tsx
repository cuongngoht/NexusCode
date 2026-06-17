import React from 'react';
import { Badge } from '@fluentui/react-components';
import type { CodeReviewVerdict } from '../../../application/code-review/CodeReviewReport';
import type { ArchitectureVerdict } from '../../../application/code-review/CodeReviewArchitectureScore';
import { useT } from '../../i18n';

interface Props {
  verdict: CodeReviewVerdict | ArchitectureVerdict;
  type?: 'review' | 'architecture';
}

const VERDICT_APPEARANCE: Record<string, 'filled' | 'outline' | 'tint'> = {
  'approve':               'filled',
  'approve-with-comments': 'tint',
  'request-changes':       'filled',
  'healthy':               'filled',
  'acceptable-with-debt':  'tint',
  'needs-refactor':        'outline',
  'architecture-blocker':  'filled',
};

const VERDICT_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'important' | 'informative'> = {
  'approve':               'success',
  'approve-with-comments': 'warning',
  'request-changes':       'danger',
  'healthy':               'success',
  'acceptable-with-debt':  'warning',
  'needs-refactor':        'important',
  'architecture-blocker':  'danger',
};

export function ReviewVerdictBadge({ verdict, type = 'review' }: Props): React.ReactElement {
  const t = useT();
  const labelMap = type === 'architecture'
    ? t.codeReview.architectureVerdicts as Record<string, string>
    : t.codeReview.verdicts as Record<string, string>;

  const label = labelMap[verdict] ?? verdict;
  const appearance = VERDICT_APPEARANCE[verdict] ?? 'filled';
  const color = VERDICT_COLOR[verdict] ?? 'informative';

  return (
    <Badge
      appearance={appearance}
      color={color}
      size="medium"
      shape="rounded"
    >
      {label}
    </Badge>
  );
}
