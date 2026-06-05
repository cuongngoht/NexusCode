import type { GitReviewContext } from '../core/types';

export interface ReviewPromptInput {
  userPrompt: string;
  reviewAgentMarkdown: string;
  reviewContext: GitReviewContext;
  baseWorkspacePrompt?: string;
  reviewFileContents?: string;
  conversationContext?: string;
}

export function buildReviewPrompt(input: ReviewPromptInput): string {
  const { userPrompt, reviewAgentMarkdown, reviewContext, baseWorkspacePrompt, reviewFileContents, conversationContext } = input;

  const request =
    userPrompt.trim() ||
    'Review the current branch against the selected base branch. Focus on bugs, regressions, security, tests, and maintainability.';

  const diffNotice = reviewContext.diffTruncated
    ? '\n\nNote: The git diff was truncated because it exceeded the review size limit. Prioritize visible hunks and changed file list.'
    : '';

  return [
    '# Nexus Review Agent Instructions',
    reviewAgentMarkdown,

    '# Workspace Context',
    baseWorkspacePrompt || '',

    '# Review Target',
    `Base branch: ${reviewContext.baseBranch}`,
    `Compare branch: ${reviewContext.compareBranch}`,
    `Current branch: ${reviewContext.currentBranch}`,

    '# Changed Files',
    reviewContext.changedFiles.length > 0
      ? reviewContext.changedFiles.map(f => `${f.status} ${f.path}`).join('\n')
      : 'No changed files detected.',

    '# Diff Stat',
    reviewContext.diffStat || 'No diff stat available.',

    ...(reviewFileContents ? ['# Changed Code Context', reviewFileContents] : []),

    '# Git Diff',
    '```diff',
    reviewContext.diff || 'No diff available.',
    '```',
    diffNotice,

    ...(conversationContext ? ['# Previous Conversation Context', conversationContext] : []),

    '# User Request',
    request,
  ].join('\n\n');
}
