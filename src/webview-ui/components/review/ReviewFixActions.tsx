import React from 'react';
import type { CodeReviewFinding } from '../../../application/code-review/CodeReviewFinding';
import { useT } from '../../i18n';
import { getVsCodeApi } from '../../vscodeApi';

interface Props {
  finding: CodeReviewFinding;
  allowAutoFix?: boolean;
}

/**
 * ReviewFixActions — actions for a single finding.
 * Apply fix is always gated by approval — never auto-applied.
 */
export function ReviewFixActions({ finding, allowAutoFix = false }: Props): React.ReactElement {
  const t = useT();

  function createFixTask(): void {
    getVsCodeApi().postMessage({
      type: 'runTask',
      prompt: `Fix: ${finding.title}\n\n${finding.refactorRecommendation ?? finding.recommendation}`,
      provider: 'nexus' as const,
      mode: 'edit' as const,
      conversationId: '',
    });
  }

  function requestApplyFix(): void {
    if (!allowAutoFix) {
      // Show approval gate: for now we open a task with plan approval required
      getVsCodeApi().postMessage({
        type: 'runTask',
        prompt: `Review Fix Proposal (requires approval before apply):\n\nFinding: ${finding.title}\n\nRecommendation: ${finding.recommendation}${finding.suggestedPatch ? `\n\nPatch:\n${finding.suggestedPatch}` : ''}`,
        provider: 'nexus' as const,
        mode: 'plan' as const,
        conversationId: '',
      });
    }
  }

  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
      <button
        onClick={createFixTask}
        style={{ fontSize: '12px', padding: '2px 8px', cursor: 'pointer' }}
        className="nexus-btn"
        title={t.codeReview.createFixTaskHint}
      >
        {t.codeReview.createFixTask}
      </button>
      {finding.suggestedPatch && (
        <button
          onClick={requestApplyFix}
          style={{ fontSize: '12px', padding: '2px 8px', cursor: 'pointer' }}
          className="nexus-btn"
          title={t.codeReview.applyFixApprovalHint}
        >
          {t.codeReview.applyFixWithApproval}
        </button>
      )}
    </div>
  );
}
