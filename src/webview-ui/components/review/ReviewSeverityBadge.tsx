import React from 'react';
import { Badge } from '@fluentui/react-components';
import type { CodeReviewSeverity } from '../../../application/code-review/CodeReviewSeverity';

interface Props {
  severity: CodeReviewSeverity;
}

const SEVERITY_COLOR: Record<CodeReviewSeverity, 'danger' | 'important' | 'warning' | 'informative' | 'subtle'> = {
  blocker:  'danger',
  critical: 'danger',
  major:    'important',
  minor:    'warning',
  nit:      'subtle',
  info:     'informative',
};

export function ReviewSeverityBadge({ severity }: Props): React.ReactElement {
  return (
    <Badge
      appearance="filled"
      color={SEVERITY_COLOR[severity]}
      size="extra-small"
      shape="rounded"
      style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
    >
      {severity}
    </Badge>
  );
}
