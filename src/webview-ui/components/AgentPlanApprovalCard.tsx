import { useState } from 'react';
import { useT } from '../i18n';
import type { AgentPlanViewModel } from '../messages';

interface AgentPlanApprovalCardProps {
  plan: AgentPlanViewModel;
  planText: string;
  sessionId: string;
  onApprove: (sessionId: string) => void;
  onReject: (sessionId: string, reason?: string) => void;
}

function complexityClass(complexity: AgentPlanViewModel['estimatedComplexity']): string {
  switch (complexity) {
    case 'low': return 'nx-perm-risk-low';
    case 'high': return 'nx-perm-risk-high';
    default: return 'nx-perm-risk-medium';
  }
}

export function AgentPlanApprovalCard({
  plan,
  planText,
  sessionId,
  onApprove,
  onReject,
}: AgentPlanApprovalCardProps) {
  const t = useT();
  const a = t.agentMode.approval;
  const [showPlanText, setShowPlanText] = useState(false);

  const complexityLabel =
    plan.estimatedComplexity === 'low' ? a.complexityLow :
    plan.estimatedComplexity === 'high' ? a.complexityHigh :
    a.complexityMedium;

  const listSections: { label: string; items: string[] }[] = [
    { label: a.filesToRead, items: plan.filesToRead },
    { label: a.filesToEdit, items: plan.filesToEdit },
    { label: a.filesToCreate, items: plan.filesToCreate },
    { label: a.filesToDelete, items: plan.filesToDelete },
    { label: a.commands, items: plan.commandsToRun },
    { label: a.risks, items: plan.risks },
    { label: a.assumptions, items: plan.assumptions },
    { label: a.testStrategy, items: plan.testStrategy },
    { label: a.rollback, items: plan.rollbackStrategy },
    { label: a.docsImpact, items: plan.docsImpact },
    { label: a.securityImpact, items: plan.securityImpact },
  ];

  return (
    <div className={`nx-perm-card ${complexityClass(plan.estimatedComplexity)}`}>
      <div className="nx-perm-card-header">
        <div className="nx-perm-card-title-row">
          <span className="nx-perm-card-subject">{a.title}</span>
          <span className={`nx-perm-card-risk-badge ${complexityClass(plan.estimatedComplexity)}`}>
            {a.complexity}: {complexityLabel}
          </span>
        </div>
        <div className="nx-perm-card-title">{a.description}</div>
      </div>

      <div className="nx-perm-card-body">
        <div className="nx-perm-card-reason">
          <span className="nx-perm-card-label">{a.summary}:</span>
          <span>{plan.summary}</span>
        </div>

        {listSections.filter(s => s.items.length > 0).map(section => (
          <div key={section.label} className="nx-perm-card-field">
            <span className="nx-perm-card-label">{section.label}:</span>
            <ul className="nx-agent-plan-list">
              {section.items.map((item, i) => (
                <li key={i}><code className="nx-perm-card-path">{item}</code></li>
              ))}
            </ul>
          </div>
        ))}

        {planText && (
          <div className="nx-perm-card-diff-section">
            <button
              type="button"
              className="nx-perm-card-diff-toggle"
              onClick={() => setShowPlanText(v => !v)}
            >
              {a.planText}
            </button>
            <button
              type="button"
              className="nx-perm-card-diff-toggle"
              onClick={() => { void navigator.clipboard?.writeText(planText); }}
            >
              {a.copyPlan}
            </button>
            {showPlanText && (
              <pre className="nx-perm-card-diff">{planText}</pre>
            )}
          </div>
        )}
      </div>

      <div className="nx-perm-card-actions">
        <button
          type="button"
          className="fl-btn-primary nx-perm-btn-approve"
          onClick={() => onApprove(sessionId)}
        >
          {a.approveButton}
        </button>
        <button
          type="button"
          className="fl-btn-secondary nx-perm-btn-reject"
          onClick={() => onReject(sessionId)}
        >
          {a.rejectButton}
        </button>
      </div>
    </div>
  );
}
