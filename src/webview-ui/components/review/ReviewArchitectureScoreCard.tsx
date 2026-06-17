import React from 'react';
import { ProgressBar, Text } from '@fluentui/react-components';
import type { ArchitectureScore } from '../../../application/code-review/CodeReviewArchitectureScore';
import { useT } from '../../i18n';

interface Props {
  score: ArchitectureScore;
}

function ScoreBar({ value, label }: { value: number; label: string }): React.ReactElement {
  const color: 'success' | 'warning' | 'error' = value >= 85 ? 'success' : value >= 70 ? 'warning' : 'error';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
      <Text size={200} style={{ color: 'var(--vscode-descriptionForeground)', width: '100px', flexShrink: 0 }}>{label}</Text>
      <ProgressBar value={value / 100} color={color} thickness="medium" style={{ flex: 1 }} />
      <Text size={200} weight="semibold" style={{ width: '30px', textAlign: 'right' }}>{value}</Text>
    </div>
  );
}

export function ReviewArchitectureScoreCard({ score }: Props): React.ReactElement {
  const t = useT();
  const s = t.codeReview.architectureScore;

  const overallColor = score.overall >= 85 ? 'var(--vscode-testing-iconPassed)'
    : score.overall >= 70 ? 'var(--vscode-notificationsWarningIcon-foreground)'
    : 'var(--vscode-errorForeground)';

  const riskColor = score.riskLevel === 'low' ? 'var(--vscode-testing-iconPassed)'
    : score.riskLevel === 'medium' ? 'var(--vscode-notificationsWarningIcon-foreground)'
    : 'var(--vscode-errorForeground)';

  return (
    <div style={{
      border: '1px solid var(--vscode-editorWidget-border)',
      borderRadius: '6px',
      padding: '12px 16px',
      marginBottom: '12px',
      background: 'var(--vscode-editorWidget-background)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <Text weight="semibold" size={300}>{s.title}</Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Text size={200} style={{ color: riskColor }}>
            {s.riskLevel}: <Text weight="semibold" size={200}>{score.riskLevel}</Text>
          </Text>
          <Text size={500} weight="bold" style={{ color: overallColor }}>{score.overall}</Text>
        </div>
      </div>
      <ScoreBar value={score.coupling}      label={s.coupling} />
      <ScoreBar value={score.cohesion}      label={s.cohesion} />
      <ScoreBar value={score.abstraction}   label={s.abstraction} />
      <ScoreBar value={score.testability}   label={s.testability} />
      <ScoreBar value={score.extensibility} label={s.extensibility} />
      <ScoreBar value={score.readability}   label={s.readability} />
    </div>
  );
}
