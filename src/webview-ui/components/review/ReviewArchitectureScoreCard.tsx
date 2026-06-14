import React from 'react';
import type { ArchitectureScore } from '../../../application/code-review/CodeReviewArchitectureScore';
import { useT } from '../../i18n';

interface Props {
  score: ArchitectureScore;
}

function ScoreBar({ value, label }: { value: number; label: string }): React.ReactElement {
  const color = value >= 85 ? 'var(--vscode-testing-iconPassed)'
    : value >= 70 ? 'var(--vscode-notificationsWarningIcon-foreground)'
    : 'var(--vscode-errorForeground)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
      <span style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)', width: '100px', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, background: 'var(--vscode-progressBar-background)', borderRadius: '3px', height: '6px', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, background: color, height: '100%', borderRadius: '3px', transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: '12px', color, width: '30px', textAlign: 'right', fontWeight: 600 }}>{value}</span>
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
        <span style={{ fontWeight: 600, fontSize: '13px' }}>{s.title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '11px', color: riskColor }}>
            {s.riskLevel}: <strong>{score.riskLevel}</strong>
          </span>
          <span style={{ fontSize: '22px', fontWeight: 700, color: overallColor }}>{score.overall}</span>
        </div>
      </div>
      <ScoreBar value={score.coupling}     label={s.coupling} />
      <ScoreBar value={score.cohesion}     label={s.cohesion} />
      <ScoreBar value={score.abstraction}  label={s.abstraction} />
      <ScoreBar value={score.testability}  label={s.testability} />
      <ScoreBar value={score.extensibility} label={s.extensibility} />
      <ScoreBar value={score.readability}  label={s.readability} />
    </div>
  );
}
