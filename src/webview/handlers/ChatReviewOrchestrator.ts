import * as vscode from 'vscode';
import type { ExtensionMessage, WebviewMessage } from '../webviewProtocol';
import type { ProviderId, TaskMode, PromptAttachment } from '../../core/types';
import type { ChatHistoryState } from '../../core/chat/ChatHistory';
import { parseAgentMentions } from '../../context/agentMentionParser';
import { ensureWorkspaceAgents, listAgentMetadata } from '../../context/agentPromptLibrary';
import { classifyReviewAgent } from '../../application/code-review/ReviewAgentClassifier';
import { detectReviewIntent } from '../../application/code-review/ReviewIntentDetector';
import { resolveReviewTarget } from '../../application/code-review/ReviewTargetResolver';
import { PendingReviewStore } from '../../application/code-review/PendingReviewStore';
import type { CodeReviewTarget } from '../../application/code-review/CodeReviewTarget';
import type { CodeReviewPreset } from '../../application/code-review/CodeReviewPromptBuilder';
import { buildGitReviewContext } from '../../git/gitReviewContext';
import { requireWorkspaceRoot } from './workspaceUtils';

type ResolveTarget = Extract<WebviewMessage, { type: 'resolveReviewTargetSelection' }>['selectedTarget'];

type RunTaskFn = (
  prompt: string,
  providerId: ProviderId,
  mode: TaskMode,
  model: string | undefined,
  baseBranch: string | undefined,
  latestHistory: ChatHistoryState | null,
  conversationContext: string | undefined,
  attachments?: PromptAttachment[],
  subagentsEnabled?: boolean,
  reviewTarget?: CodeReviewTarget,
  reviewPreset?: CodeReviewPreset,
) => Promise<void>;

export class ChatReviewOrchestrator {
  private readonly pendingStore = new PendingReviewStore();

  constructor(
    private readonly post: (msg: ExtensionMessage) => void,
    private readonly runTask: RunTaskFn,
    private readonly extensionRoot: string,
  ) {}

  /**
   * Returns true if this orchestrator intercepts the request (review flow).
   * Returns false if normal task execution should proceed.
   */
  async tryIntercept(
    prompt: string,
    providerId: ProviderId,
    mode: TaskMode,
    model: string | undefined,
    attachments: PromptAttachment[] | undefined,
    latestHistory: ChatHistoryState | null,
    conversationContext: string | undefined,
    subagentsEnabled: boolean,
  ): Promise<boolean> {
    // Already in review mode — RunTaskHandler handles it (supplement step via @agent mention).
    if (mode === 'review') return false;

    const workspaceRoot = requireWorkspaceRoot(this.post);
    if (!workspaceRoot) return false;

    const cfg = vscode.workspace.getConfiguration('nexus');

    // Copy bundled agents to .nexus/agents/ if not already there (required before metadata scan).
    if (cfg.get<boolean>('agents.autoCopyDefaults', true)) {
      ensureWorkspaceAgents(workspaceRoot, this.extensionRoot);
    }

    const allMetadata = listAgentMetadata(workspaceRoot);
    const knownAgentIds = allMetadata.map(m => m.id);
    const { agentIds, cleanedPrompt } = parseAgentMentions(prompt, knownAgentIds);
    if (agentIds.length === 0) return false;

    const mentionedMetadata = allMetadata.filter(m => agentIds.includes(m.id));
    const reviewCapableAgents = mentionedMetadata.filter(m => classifyReviewAgent(m, { allowInference: false }).isReviewCapable);
    if (reviewCapableAgents.length === 0) return false;

    const intent = detectReviewIntent(cleanedPrompt);
    // Pure @mention with no review keywords → default to branch-review so the user picks
    // which branch to compare against, instead of the full ambiguous-target dialog.
    const effectiveIntent =
      intent.kind === 'none'
        ? { kind: 'branch-review' as const, confidence: 'medium' as const, reasons: ['review agent mentioned'] }
        : intent;
    if (effectiveIntent.kind === 'none') return false;
    const inspected = cfg.inspect<string>('review.defaultBaseBranch');
    const hasUserConfiguredDefaultBaseBranch =
      inspected?.globalValue !== undefined ||
      inspected?.workspaceValue !== undefined ||
      inspected?.workspaceFolderValue !== undefined;
    const defaultBaseBranch = cfg.get<string>('review.defaultBaseBranch');
    const autoUseDefaultBaseBranch = cfg.get<boolean>('review.autoUseDefaultBaseBranch', false);

    let currentBranch: string | undefined;
    let availableBranches: string[] | undefined;
    let hasStagedChanges: boolean | undefined;
    let hasWorkingTreeChanges: boolean | undefined;

    try {
      const gitCtx = buildGitReviewContext(workspaceRoot, undefined, 1000);
      currentBranch = gitCtx.currentBranch;
      availableBranches = gitCtx.availableBranches;
      hasWorkingTreeChanges = gitCtx.changedFiles.length > 0;
      hasStagedChanges = hasWorkingTreeChanges;
    } catch {
      // non-blocking — missing git or no repo
    }

    const resolution = resolveReviewTarget({
      intent: effectiveIntent,
      explicitBaseBranch: effectiveIntent.explicitBaseBranch,
      currentBranch,
      availableBranches,
      hasStagedChanges,
      hasWorkingTreeChanges,
      config: {
        defaultBaseBranch,
        hasUserConfiguredDefaultBaseBranch,
        autoUseDefaultBaseBranch,
      },
    });

    if (resolution.status === 'not-review') return false;

    const selectedReviewAgentIds = reviewCapableAgents.map(m => m.id);

    if (resolution.status === 'ready') {
      await this._runReview(
        prompt, providerId, model, attachments,
        latestHistory, conversationContext, subagentsEnabled,
        selectedReviewAgentIds, resolution.target,
      );
      return true;
    }

    // Needs selection — store pending and prompt webview
    const requestId = this.pendingStore.store({
      originalPrompt: prompt,
      cleanedPrompt,
      mode,
      providerId,
      model,
      selectedAgentIds: agentIds,
      selectedReviewAgentIds,
      attachments: attachments ?? [],
    });

    this.post({
      type: 'reviewTargetSelectionRequired',
      requestId,
      reason: resolution.reason,
      currentBranch: resolution.currentBranch,
      suggestedTargets: resolution.suggestedTargets,
      selectedAgentIds: agentIds,
      selectedReviewAgentIds,
      availableBranches: resolution.availableBranches,
      defaultBaseBranch: hasUserConfiguredDefaultBaseBranch ? defaultBaseBranch : undefined,
    });

    return true;
  }

  async resolveTarget(
    requestId: string,
    selectedTarget: ResolveTarget,
    latestHistory: ChatHistoryState | null,
    conversationContext: string | undefined,
  ): Promise<void> {
    const pending = this.pendingStore.get(requestId);
    if (!pending) return;
    this.pendingStore.clear(requestId);

    let reviewTarget: CodeReviewTarget;
    if (selectedTarget.type === 'branch') {
      reviewTarget = { type: 'branch', baseBranch: selectedTarget.baseBranch };
    } else if (selectedTarget.type === 'file') {
      reviewTarget = { type: 'file', filePath: selectedTarget.path };
    } else {
      reviewTarget = { type: selectedTarget.type as CodeReviewTarget['type'] };
    }

    await this._runReview(
      pending.originalPrompt,
      pending.providerId as ProviderId,
      pending.model,
      pending.attachments,
      latestHistory,
      conversationContext,
      false,
      pending.selectedReviewAgentIds,
      reviewTarget,
    );
  }

  cancelTarget(requestId: string): void {
    this.pendingStore.clear(requestId);
    this.post({ type: 'reviewTargetSelectionCancelled', requestId });
  }

  clearAll(): void {
    this.pendingStore.clearAll();
  }

  private async _runReview(
    prompt: string,
    providerId: ProviderId,
    model: string | undefined,
    attachments: PromptAttachment[] | undefined,
    latestHistory: ChatHistoryState | null,
    conversationContext: string | undefined,
    subagentsEnabled: boolean,
    _selectedReviewAgentIds: string[],
    reviewTarget: CodeReviewTarget,
  ): Promise<void> {
    await this.runTask(
      prompt,
      providerId,
      'review',
      model,
      reviewTarget.baseBranch,
      latestHistory,
      conversationContext,
      attachments,
      subagentsEnabled,
      reviewTarget,
    );
  }
}
