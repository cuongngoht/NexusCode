import type { ReviewIntentResult } from './ReviewIntentDetector';
import type { CodeReviewTarget } from './CodeReviewTarget';

export type ReviewTargetResolution =
  | {
      status: 'ready';
      target: CodeReviewTarget;
    }
  | {
      status: 'needs-selection';
      reason:
        | 'ambiguous-review-target'
        | 'missing-base-branch'
        | 'missing-active-file'
        | 'missing-selection'
        | 'no-staged-changes'
        | 'no-working-tree-changes';
      currentBranch?: string;
      suggestedTargets: Array<'branch' | 'working-tree' | 'staged' | 'file' | 'selection'>;
      availableBranches?: string[];
    }
  | {
      status: 'not-review';
    };

export interface ResolveReviewTargetInput {
  intent: ReviewIntentResult;
  selectedBaseBranch?: string;
  explicitBaseBranch?: string;
  currentBranch?: string;
  activeFilePath?: string;
  hasSelection?: boolean;
  hasStagedChanges?: boolean;
  hasWorkingTreeChanges?: boolean;
  availableBranches?: string[];
  config: {
    defaultBaseBranch?: string;
    hasUserConfiguredDefaultBaseBranch: boolean;
    autoUseDefaultBaseBranch: boolean;
  };
}

export function resolveReviewTarget(input: ResolveReviewTargetInput): ReviewTargetResolution {
  const { intent, config } = input;

  // Not a review
  if (intent.kind === 'none') {
    return { status: 'not-review' };
  }

  // Helper: resolve base branch (explicit > selected > auto-default)
  function resolveBaseBranch(): string | undefined {
    if (intent.explicitBaseBranch) return intent.explicitBaseBranch;
    if (input.explicitBaseBranch) return input.explicitBaseBranch;
    if (input.selectedBaseBranch) return input.selectedBaseBranch;
    if (
      config.autoUseDefaultBaseBranch &&
      config.hasUserConfiguredDefaultBaseBranch &&
      config.defaultBaseBranch
    ) {
      return config.defaultBaseBranch;
    }
    return undefined;
  }

  switch (intent.kind) {
    case 'branch-review': {
      const baseBranch = resolveBaseBranch();
      if (baseBranch) {
        return {
          status: 'ready',
          target: { type: 'branch', baseBranch },
        };
      }
      return {
        status: 'needs-selection',
        reason: 'missing-base-branch',
        currentBranch: input.currentBranch,
        suggestedTargets: ['branch'],
        availableBranches: input.availableBranches,
      };
    }

    case 'general-code-review': {
      return {
        status: 'needs-selection',
        reason: 'ambiguous-review-target',
        currentBranch: input.currentBranch,
        suggestedTargets: ['branch', 'working-tree', 'staged', 'file', 'selection'],
        availableBranches: input.availableBranches,
      };
    }

    case 'staged-review': {
      if (input.hasStagedChanges === false) {
        return {
          status: 'needs-selection',
          reason: 'no-staged-changes',
          suggestedTargets: ['staged'],
        };
      }
      return { status: 'ready', target: { type: 'staged' } };
    }

    case 'working-tree-review': {
      if (input.hasWorkingTreeChanges === false) {
        return {
          status: 'needs-selection',
          reason: 'no-working-tree-changes',
          suggestedTargets: ['working-tree'],
        };
      }
      return { status: 'ready', target: { type: 'working-tree' } };
    }

    case 'file-review': {
      if (!input.activeFilePath) {
        return {
          status: 'needs-selection',
          reason: 'missing-active-file',
          suggestedTargets: ['file'],
        };
      }
      return { status: 'ready', target: { type: 'file', filePath: input.activeFilePath } };
    }

    case 'selection-review': {
      if (!input.hasSelection) {
        return {
          status: 'needs-selection',
          reason: 'missing-selection',
          suggestedTargets: ['selection'],
        };
      }
      return { status: 'ready', target: { type: 'selection' } };
    }

    default:
      return { status: 'not-review' };
  }
}
