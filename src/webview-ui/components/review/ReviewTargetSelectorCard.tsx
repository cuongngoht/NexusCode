import { useState } from 'react';
import { getVsCodeApi } from '../../vscodeApi';
import type { PendingReviewSelection } from '../../messages';

interface Props {
  selection: PendingReviewSelection;
  onDismiss: () => void;
}

type TargetKind = 'branch' | 'working-tree' | 'staged' | 'file' | 'selection';

const TARGET_LABELS: Record<TargetKind, string> = {
  branch: 'Compare current branch against...',
  'working-tree': 'Working tree changes',
  staged: 'Staged changes',
  file: 'Current file',
  selection: 'Selected code',
};

const REASON_TITLES: Record<PendingReviewSelection['reason'], string> = {
  'ambiguous-review-target': 'What do you want to review?',
  'missing-base-branch': 'Review against which base branch?',
  'missing-active-file': 'No active file open',
  'missing-selection': 'No code selected',
  'no-staged-changes': 'No staged changes found',
  'no-working-tree-changes': 'No working tree changes found',
};

export function ReviewTargetSelectorCard({ selection, onDismiss }: Props) {
  const [selectedTarget, setSelectedTarget] = useState<TargetKind | null>(
    selection.reason === 'missing-base-branch' ? 'branch' : null,
  );
  const [selectedBranch, setSelectedBranch] = useState<string>(
    selection.defaultBaseBranch ?? '',
  );
  const [customBranch, setCustomBranch] = useState('');
  const [showBranchPicker, setShowBranchPicker] = useState(
    selection.reason === 'missing-base-branch',
  );

  const vscodeApi = getVsCodeApi();
  const title = REASON_TITLES[selection.reason] ?? 'Select review target';
  const branchTitle = selection.currentBranch
    ? `Review ${selection.currentBranch} against which base?`
    : 'Review against which base branch?';

  function handleTargetSelect(target: TargetKind) {
    setSelectedTarget(target);
    if (target === 'branch') {
      setShowBranchPicker(true);
    } else {
      // Non-branch targets resolve immediately
      vscodeApi.postMessage({
        type: 'resolveReviewTargetSelection',
        requestId: selection.requestId,
        selectedTarget: { type: target },
      });
      onDismiss();
    }
  }

  function handleBranchSelect(branch: string) {
    if (!branch.trim()) return;
    vscodeApi.postMessage({
      type: 'resolveReviewTargetSelection',
      requestId: selection.requestId,
      selectedTarget: { type: 'branch', baseBranch: branch.trim() },
    });
    onDismiss();
  }

  function handleCancel() {
    vscodeApi.postMessage({
      type: 'cancelReviewTargetSelection',
      requestId: selection.requestId,
    });
    onDismiss();
  }

  const availableBranches = selection.availableBranches ?? [];
  const filteredBranches = availableBranches.filter(
    b => b !== selection.currentBranch,
  );

  return (
    <div className="nx-review-target-card">
      <div className="nx-review-target-card__header">
        <span className="nx-review-target-card__icon">⚡</span>
        <span className="nx-review-target-card__title">
          {showBranchPicker && selectedTarget === 'branch' ? branchTitle : title}
        </span>
        <button
          className="nx-review-target-card__close"
          onClick={handleCancel}
          title="Cancel"
        >
          ✕
        </button>
      </div>

      {selection.selectedReviewAgentIds.length > 0 && (
        <div className="nx-review-target-card__agents">
          {selection.selectedReviewAgentIds.map(id => (
            <span key={id} className="nx-review-target-card__agent-chip">
              @{id}
            </span>
          ))}
        </div>
      )}

      {/* Branch picker */}
      {showBranchPicker && selectedTarget === 'branch' ? (
        <div className="nx-review-target-card__branch-picker">
          {filteredBranches.length > 0 && (
            <div className="nx-review-target-card__branch-list">
              {filteredBranches.slice(0, 8).map(branch => (
                <button
                  key={branch}
                  className={`nx-review-target-card__branch-btn${selectedBranch === branch ? ' nx-review-target-card__branch-btn--selected' : ''}`}
                  onClick={() => setSelectedBranch(branch)}
                >
                  {branch}
                </button>
              ))}
            </div>
          )}
          <div className="nx-review-target-card__branch-custom">
            <input
              type="text"
              className="nx-review-target-card__branch-input"
              placeholder="Or type a branch name..."
              value={customBranch}
              onChange={e => setCustomBranch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && customBranch.trim()) {
                  handleBranchSelect(customBranch);
                }
              }}
            />
          </div>
          <div className="nx-review-target-card__actions">
            <button
              className="nx-review-target-card__btn nx-review-target-card__btn--primary"
              onClick={() => handleBranchSelect(customBranch || selectedBranch)}
              disabled={!customBranch.trim() && !selectedBranch}
            >
              Start review
            </button>
            <button
              className="nx-review-target-card__btn"
              onClick={handleCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* Target type selector */
        <div className="nx-review-target-card__targets">
          {selection.suggestedTargets.map(target => (
            <button
              key={target}
              className="nx-review-target-card__target-btn"
              onClick={() => handleTargetSelect(target)}
            >
              {TARGET_LABELS[target] ?? target}
            </button>
          ))}
          <button
            className="nx-review-target-card__btn nx-review-target-card__btn--cancel"
            onClick={handleCancel}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
