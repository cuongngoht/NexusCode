import { useState } from 'react';
import type { PermissionRequestViewModel } from '../messages';

interface PermissionApprovalCardProps {
  request: PermissionRequestViewModel;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string, reason?: string) => void;
  onAutoApproveSession: (requestId: string) => void;
}

function getRiskClass(risk: string): string {
  switch (risk) {
    case 'low': return 'nx-perm-risk-low';
    case 'medium': return 'nx-perm-risk-medium';
    case 'high': return 'nx-perm-risk-high';
    case 'blocked': return 'nx-perm-risk-blocked';
    default: return 'nx-perm-risk-medium';
  }
}

function getRiskLabel(risk: string): string {
  switch (risk) {
    case 'low': return 'Low Risk';
    case 'medium': return 'Medium Risk';
    case 'high': return 'High Risk';
    case 'blocked': return 'Blocked';
    default: return risk;
  }
}

function formatSubjectLabel(label: string, subjectType: string): string {
  if (subjectType === 'agent') return `@${label.replace(/^@/, '')}`;
  if (subjectType === 'command') return `/${label.replace(/^\//, '')}`;
  if (subjectType === 'skill') return `#${label.replace(/^#/, '')}`;
  return label;
}

export function PermissionApprovalCard({
  request,
  onApprove,
  onReject,
  onAutoApproveSession,
}: PermissionApprovalCardProps) {
  const [showDiff, setShowDiff] = useState(false);
  const isBlocked = request.risk === 'blocked';
  const subjectDisplay = formatSubjectLabel(request.subjectLabel, request.subjectType);

  return (
    <div className={`nx-perm-card ${getRiskClass(request.risk)}`}>
      <div className="nx-perm-card-header">
        <div className="nx-perm-card-title-row">
          <span className="nx-perm-card-subject">{subjectDisplay}</span>
          <span className={`nx-perm-card-risk-badge ${getRiskClass(request.risk)}`}>
            {getRiskLabel(request.risk)}
          </span>
        </div>
        <div className="nx-perm-card-title">{request.title}</div>
      </div>

      <div className="nx-perm-card-body">
        <div className="nx-perm-card-action">
          <span className="nx-perm-card-label">Action:</span>
          <code className="nx-perm-card-action-type">{request.actionType}</code>
        </div>

        {request.target && (
          <div className="nx-perm-card-field">
            <span className="nx-perm-card-label">Target:</span>
            <code className="nx-perm-card-path">{request.target}</code>
          </div>
        )}

        {request.command && (
          <div className="nx-perm-card-field">
            <span className="nx-perm-card-label">Command:</span>
            <code className="nx-perm-card-command">{request.command}</code>
          </div>
        )}

        {request.cwd && (
          <div className="nx-perm-card-field">
            <span className="nx-perm-card-label">Directory:</span>
            <code className="nx-perm-card-path">{request.cwd}</code>
          </div>
        )}

        <div className="nx-perm-card-reason">
          <span className="nx-perm-card-label">Reason:</span>
          <span>{request.reason}</span>
        </div>

        {request.diffPreview && (
          <div className="nx-perm-card-diff-section">
            <button
              type="button"
              className="nx-perm-card-diff-toggle"
              onClick={() => setShowDiff(v => !v)}
            >
              {showDiff ? 'Hide diff preview' : 'Show diff preview'}
            </button>
            {showDiff && (
              <pre className="nx-perm-card-diff">{request.diffPreview}</pre>
            )}
          </div>
        )}
      </div>

      <div className="nx-perm-card-actions">
        {isBlocked ? (
          <div className="nx-perm-card-blocked-msg">
            This action is blocked by policy and cannot be approved.
          </div>
        ) : (
          <>
            <button
              type="button"
              className="fl-btn-primary nx-perm-btn-approve"
              onClick={() => onApprove(request.id)}
            >
              Approve
            </button>
            <button
              type="button"
              className="fl-btn-secondary nx-perm-btn-auto"
              onClick={() => onAutoApproveSession(request.id)}
              title="Auto-approve this type of action for the rest of this session"
              disabled={request.risk === 'high'}
            >
              Auto-approve session
            </button>
          </>
        )}
        <button
          type="button"
          className="fl-btn-secondary nx-perm-btn-reject"
          onClick={() => onReject(request.id)}
        >
          {isBlocked ? 'Dismiss' : 'Reject'}
        </button>
      </div>
    </div>
  );
}
