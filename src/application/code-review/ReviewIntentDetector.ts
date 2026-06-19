export type ReviewIntentKind =
  | 'none'
  | 'general-code-review'
  | 'branch-review'
  | 'working-tree-review'
  | 'staged-review'
  | 'file-review'
  | 'selection-review';

export interface ReviewIntentResult {
  kind: ReviewIntentKind;
  confidence: 'low' | 'medium' | 'high';
  explicitBaseBranch?: string;
  reasons: string[];
}

// Matches "against <branch>", "vs <branch>", "compare to <branch>", etc.
const BASE_BRANCH_RE = /\b(?:against|vs\.?|compare(?:\s+to)?|versus|against\s+branch)\s+([a-zA-Z0-9/_.-]+)/i;

const STAGED_SIGNALS = [
  'staged changes',
  'staged',
  'git add',
  'index changes',
  'staged file',
];

const WORKING_TREE_SIGNALS = [
  'working tree',
  'working directory',
  'unstaged',
  'local changes',
  'current diff',
  'uncommitted',
];

const FILE_SIGNALS = [
  'current file',
  'this file',
  'active file',
  'review file',
  'review current file',
];

const SELECTION_SIGNALS = [
  'selected code',
  'selection',
  'highlighted code',
  'selected text',
  'review selected',
];

const BRANCH_SIGNALS = [
  'current branch',
  'review branch',
  'review pr',
  'review pull request',
  'this pr',
  'this branch',
  'audit pr',
  'audit branch',
  'review this pr',
  'before merge',
  'pre-merge',
  'merge review',
  'review changes from',
];

const GENERAL_REVIEW_SIGNALS = [
  'review changes',
  'review code',
  'code review',
  'review my changes',
  'review these changes',
  'review this code',
  'give me a review',
  'do a review',
  'run a review',
];

function matchesAny(text: string, signals: string[]): boolean {
  return signals.some(s => text.includes(s));
}

function detectExplicitBaseBranch(text: string): string | undefined {
  const m = BASE_BRANCH_RE.exec(text);
  if (!m) return undefined;
  const branch = m[1].trim();
  // Reject common noise words that are not branch names
  if (['the', 'a', 'an', 'my', 'this', 'that', 'our', 'your'].includes(branch.toLowerCase())) {
    return undefined;
  }
  return branch;
}

export function detectReviewIntent(prompt: string): ReviewIntentResult {
  const text = prompt.toLowerCase().trim();
  const reasons: string[] = [];

  // Check most-specific targets first to avoid false matches from broader signals

  if (matchesAny(text, STAGED_SIGNALS)) {
    reasons.push('staged review signals found');
    return { kind: 'staged-review', confidence: 'high', reasons };
  }

  if (matchesAny(text, WORKING_TREE_SIGNALS)) {
    reasons.push('working tree signals found');
    return { kind: 'working-tree-review', confidence: 'high', reasons };
  }

  if (matchesAny(text, FILE_SIGNALS)) {
    reasons.push('file review signals found');
    return { kind: 'file-review', confidence: 'high', reasons };
  }

  if (matchesAny(text, SELECTION_SIGNALS)) {
    reasons.push('selection review signals found');
    return { kind: 'selection-review', confidence: 'high', reasons };
  }

  if (matchesAny(text, BRANCH_SIGNALS)) {
    const explicitBaseBranch = detectExplicitBaseBranch(text);
    reasons.push('branch review signals found');
    return { kind: 'branch-review', confidence: 'high', explicitBaseBranch, reasons };
  }

  if (matchesAny(text, GENERAL_REVIEW_SIGNALS)) {
    reasons.push('general review signals found');
    return { kind: 'general-code-review', confidence: 'medium', reasons };
  }

  reasons.push('no review signals found');
  return { kind: 'none', confidence: 'low', reasons };
}
