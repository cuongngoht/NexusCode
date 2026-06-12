import type {
  ChatHistoryState,
  SerializedConversation,
  SerializedChatMessage,
  SerializedConversationCompactSummary,
} from '../core/chat/ChatHistory';
import type {
  TokenRunUsage,
  ConversationTokenUsage,
  ProviderTokenSummary,
  TokenUsageSource,
} from '../core/tokens/TokenUsage';

export type { ChatHistoryState, SerializedChatMessage, SerializedConversationCompactSummary };

// Mirror of src/core/types.ts — keep in sync (webview bundle cannot import from core)
export type ProviderId = 'nexus' | 'codex' | 'claude' | 'antigravity' | 'copilot' | 'aider' | 'custom' | 'grok' | 'auto';
export type DirectProviderId = Exclude<ProviderId, 'nexus' | 'auto'>;
// Mirror of src/core/types.ts — keep in sync (webview bundle cannot import from core)
export type TaskMode =
  | 'ask'
  | 'research'
  | 'scan-project'
  | 'plan'
  | 'brainstorm'
  | 'edit'
  | 'debug'
  | 'test'
  | 'review';

export type ProviderModelSource = 'detected' | 'seeded';
export type AgentModeFit = 'best' | 'good' | 'limited' | 'unsupported' | 'unknown';

export interface ProviderModel {
  id: string;
  label: string;
  source: ProviderModelSource;
}

export interface GitFileChange { status: string; path: string; }

export interface AgentModeCapability {
  agentId: DirectProviderId;
  mode: TaskMode;
  fit: AgentModeFit;
  reason: string;
}

export interface AgentRecommendation {
  mode: TaskMode;
  recommended?: DirectProviderId;
  alternatives: DirectProviderId[];
  limited: DirectProviderId[];
  unavailable: DirectProviderId[];
}

export interface GitReviewContext {
  baseBranch: string;
  compareBranch: string;
  currentBranch: string;
  availableBranches: string[];
  changedFiles: GitFileChange[];
  diffStat: string;
  diff: string;
  diffTruncated: boolean;
  message?: string;
}

let _seqSuffix = 0;
const uid = (): string => `${Date.now()}-${++_seqSuffix}`;

function deriveTitle(prompt: string): string {
  // Find first non-empty, non-code-block line
  const lines = prompt.split('\n');
  let firstLine = '';
  let inCode = false;
  for (const line of lines) {
    if (line.startsWith('```')) { inCode = !inCode; continue; }
    if (inCode) continue;
    const t = line.trim();
    if (t) { firstLine = t; break; }
  }
  if (!firstLine) firstLine = prompt.trim();

  // Truncate at first sentence boundary if it falls within a reasonable range
  const sentEnd = firstLine.search(/[.?!]/);
  const base = (sentEnd > 10 && sentEnd < 60) ? firstLine.slice(0, sentEnd) : firstLine;
  const clean = base.trim();

  if (clean.length <= 52) return clean;
  // Cut at last word boundary before 52 chars, add ellipsis
  const cut = clean.slice(0, 52);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 15 ? cut.slice(0, lastSpace) : cut) + '…';
}

// ── Message types ─────────────────────────────────────────────────────────

export interface EnhancedPromptSection {
  title: string;
  content: string;
}

export interface EnhancedPromptSnapshot {
  originalPrompt: string;
  enhancedPrompt: string;
  sections: EnhancedPromptSection[];
  wasTruncated: boolean;
  generatedAt: number;
}

export interface MessageFeedback {
  rating: 'good' | 'bad' | null;
  ratedAt?: number;
}

export interface UserMessage {
  id: string;
  role: 'user';
  prompt: string;
  provider: ProviderId;
  mode: TaskMode;
  model?: string;
  timestamp: number;
  attachmentPaths?: string[];
}

export interface OutputLine {
  kind: 'stdout' | 'stderr';
  text: string;
}

export interface Activity {
  kind: string;
  status: 'running' | 'done' | 'error';
  label: string;
}

export interface PipelineStep {
  label: string;
  status: 'running' | 'done' | 'error';
  activities: Activity[];
}

export interface AssistantMessage {
  id: string;
  role: 'assistant';
  providerLabel: string;
  mode: string;
  model?: string;
  lines: OutputLine[];
  isStreaming: boolean;
  timestamp?: number;
  exitCode?: number;
  errorText?: string;
  steps: PipelineStep[];
  tokenUsage?: TokenRunUsage;
  enhancedPrompt?: string;
  enhancedPromptSnapshot?: EnhancedPromptSnapshot;
  planSaved?: boolean;
  planPath?: string;
  feedback?: MessageFeedback;
  retrySourceMessageId?: string;
  elapsed?: number;
}

export type ChatMessage = UserMessage | AssistantMessage;

// ── Conversation ──────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  gitChanges: GitFileChange[];
  gitMessage?: string;
  createdAt?: number;
  updatedAt?: number;
  tokenUsage: ConversationTokenUsage;
  compactSummary?: SerializedConversationCompactSummary;
}

export function emptyTokenUsage(): ConversationTokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    runs: 0,
    byProvider: {},
  };
}

export function aggregateConversationTokenUsage(
  messages: ChatMessage[],
): ConversationTokenUsage {
  const usage = emptyTokenUsage();
  for (const m of messages) {
    if (m.role !== 'assistant' || !(m as AssistantMessage).tokenUsage) continue;
    const u = (m as AssistantMessage).tokenUsage!;
    usage.inputTokens += u.inputTokens;
    usage.outputTokens += u.outputTokens;
    usage.totalTokens += u.totalTokens;
    usage.runs += 1;
    const key = u.provider;
    const existing: ProviderTokenSummary = usage.byProvider[key] ?? {
      provider: key,
      label: u.providerLabel || key,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      runs: 0,
      sourceBreakdown: {
        exact: 0,
        estimated: 0,
        heuristic: 0,
      } as Record<TokenUsageSource, number>,
    };
    existing.inputTokens += u.inputTokens;
    existing.outputTokens += u.outputTokens;
    existing.totalTokens += u.totalTokens;
    existing.runs += 1;
    existing.sourceBreakdown[u.source] += u.totalTokens;
    usage.byProvider[key] = existing;
  }
  return usage;
}

function makeConversation(): Conversation {
  return { id: uid(), title: 'New conversation', messages: [], gitChanges: [], tokenUsage: emptyTokenUsage() };
}

// ── App state ─────────────────────────────────────────────────────────────

export interface McpPresetStatusView {
  id: string;
  displayName: string;
  enabled: boolean;
  transport: string;
  risk: string;
}

// Mirror of AgentPrompt from src/context/agentPromptLibrary.ts — keep in sync
export interface AgentPrompt {
  id: string;
  displayName: string;
  fileName: string;
  workspacePath: string;
}

export interface AgentMentionState {
  triggerIndex: number;
  query: string;
  selectedIndex: number;
}

// Mirror of SkillPrompt from src/context/skillPromptLibrary.ts — keep in sync
export interface SkillPrompt {
  id: string;
  displayName: string;
  fileName: string;
  workspacePath: string;
}

export interface SkillMentionState {
  triggerIndex: number;
  query: string;
  selectedIndex: number;
}

export interface AppState {
  conversations: Conversation[];
  activeConvId: string;
  isRunning: boolean;
  isStopping: boolean;
  elapsed: number;
  provider: ProviderId;
  selectedModel?: string;
  mode: TaskMode;
  availableProviders: string[];
  providerDetection: ProviderInfo[];
  agentCapabilityMatrix: AgentModeCapability[];
  agentRecommendations: AgentRecommendation[];
  needsSetup: boolean;
  isDetecting: boolean;
  showHistory: boolean;
  saveKey: number;
  reviewContext?: GitReviewContext;
  reviewContextError?: string;
  historyError?: string;
  historySaveError?: string;
  historyTrimmedCount?: number;
  mcpEnabled: boolean;
  mcpActivePresets: string[];
  lastMcpUsed?: { presetId: string; presetName: string; toolName: string };
  subagentsEnabled: boolean;
  agentPrompts: AgentPrompt[];
  agentMention?: AgentMentionState;
  skillPrompts: SkillPrompt[];
  skillMention?: SkillMentionState;
  isCompacting: boolean;
  compactError?: string;
  showCompactInfo: boolean;
  activeRunConversationId?: string;
  pendingRetry?: {
    prompt: string;
    provider: ProviderId;
    mode: TaskMode;
    model?: string;
    sourceMessageId: string;
    useCurrentSettings: boolean;
  };
}

export function createInitialState(): AppState {
  const conv = makeConversation();
  return {
    conversations: [conv],
    activeConvId: conv.id,
    isRunning: false,
    isStopping: false,
    elapsed: 0,
    provider: 'nexus',
    selectedModel: undefined,
    mode: 'ask',
    availableProviders: [],
    providerDetection: [],
    agentCapabilityMatrix: [],
    agentRecommendations: [],
    needsSetup: false,
    isDetecting: true,
    showHistory: false,
    saveKey: 0,
    reviewContext: undefined,
    reviewContextError: undefined,
    historyError: undefined,
    historySaveError: undefined,
    historyTrimmedCount: undefined,
    mcpEnabled: false,
    mcpActivePresets: [],
    lastMcpUsed: undefined,
    subagentsEnabled: false,
    agentPrompts: [],
    agentMention: undefined,
    skillPrompts: [],
    skillMention: undefined,
    isCompacting: false,
    compactError: undefined,
    showCompactInfo: false,
    activeRunConversationId: undefined,
    pendingRetry: undefined,
  };
}

// ── Extension → webview messages ──────────────────────────────────────────

// Mirror of src/core/types.ts PromptAttachment — keep in sync
export interface PromptAttachment {
  type: 'file' | 'folder';
  path: string;
}

// Structural mirror of ProviderDetectionResult from src/core/providerDetector.ts —
// keep in sync (webview bundle cannot import from extension-side modules).
// id is typed as string here because the webview does not import ProviderId from core.
export interface ProviderInfo {
  id: string;
  displayName: string;
  cliLabel: string;
  installed: boolean;
  authStatus?: 'authenticated' | 'unauthenticated' | 'unknown';
  loggedIn?: boolean;
  loginCommand?: string;
  installCommand?: string;
  installDocsUrl?: string;
  version?: string;
  executablePath?: string;
  reason?: string;
  supportsModelSelection: boolean;
  defaultModel?: string;
  models: ProviderModel[];
}

export type ExtMsg =
  | { type: 'stdout'; chunk: string }
  | { type: 'stderr'; chunk: string }
  | { type: 'taskStarted'; taskId: string; provider: string; mode: string; model?: string; enhancedPrompt?: string; enhancedPromptSections?: Array<{ title: string; content: string }> }
  | { type: 'taskCompleted'; taskId: string; exitCode: number }
  | { type: 'taskStopped'; taskId: string }
  | { type: 'taskError'; taskId: string; message: string }
  | { type: 'gitStatus'; changes: GitFileChange[]; message?: string }
  | {
      type: 'availableProviders';
      providers: string[];
      detection: ProviderInfo[];
      needsSetup?: boolean;
      savedProvider?: string;
      capabilityMatrix?: AgentModeCapability[];
      recommendations?: AgentRecommendation[];
    }
  | { type: 'stepStarted'; stepLabel: string; stepIndex: number; totalSteps: number; provider: string; mode: string; model?: string }
  | { type: 'stepCompleted'; stepLabel: string }
  | { type: 'stepError'; stepLabel: string; error: string }
  | { type: 'activityStarted'; activityKind: string; label: string }
  | { type: 'activityDone'; activityKind: string; label: string; status: 'done' | 'error' }
  | { type: 'historyLoaded'; history: ChatHistoryState }
  | { type: 'historyError'; message: string }
  | { type: 'historySaveError'; message: string }
  | { type: 'historyTrimmed'; removedCount: number }
  | { type: 'reviewContext'; context: GitReviewContext }
  | { type: 'reviewContextError'; message: string }
  | {
      type: 'tokenUsageUpdated';
      taskId: string;
      phase: 'preview' | 'final';
      usage: TokenRunUsage;
    }
  | { type: 'planSaved'; taskId: string; planPath?: string }
  | { type: 'promptAttachmentPicked'; attachment: PromptAttachment }
  | { type: 'workspaceFiles'; files: string[] }
  | { type: 'mcpStatus'; enabled: boolean; presets: McpPresetStatusView[] }
  | { type: 'mcpUsed'; presetId: string; presetName: string; toolName: string }
  | { type: 'agentPrompts'; agents: AgentPrompt[] }
  | { type: 'agentsReloaded'; count: number; agents: AgentPrompt[] }
  | { type: 'agentPromptError'; message: string }
  | { type: 'skillPrompts'; skills: SkillPrompt[] }
  | { type: 'skillsReloaded'; count: number; skills: SkillPrompt[] }
  | { type: 'skillPromptError'; message: string }
  | { type: 'compactStarted'; conversationId: string }
  | { type: 'compactSummaryUpdated'; conversationId: string; summary: SerializedConversationCompactSummary }
  | { type: 'compactSummaryError'; conversationId: string; message: string };

// ── Actions ───────────────────────────────────────────────────────────────

export type AppAction =
  | { type: 'extMsg'; msg: ExtMsg }
  | { type: 'tick' }
  | { type: 'stopTask' }
  | { type: 'setProvider'; value: ProviderId }
  | { type: 'setModel'; value?: string }
  | { type: 'setMode'; value: TaskMode }
  | { type: 'toggleHistory' }
  | { type: 'toggleSubagents' }
  | { type: 'resetSubagents' }
  | { type: 'newConversation' }
  | { type: 'selectConversation'; id: string }
  | { type: 'deleteConversation'; id: string }
  | { type: 'clearHistory' }
  | {
    type: 'sendUserMessage';
    prompt: string;
    provider: ProviderId;
    mode: TaskMode;
    model?: string;
    timestamp: number;
  }
  | { type: 'setAgentMention'; state: AgentMentionState | undefined }
  | { type: 'setSkillMention'; state: SkillMentionState | undefined }
  | { type: 'clearConvCompactSummary' }
  | { type: 'toggleCompactInfo' }
  | { type: 'setFeedback'; conversationId: string; messageId: string; rating: 'good' | 'bad' | null }
  | { type: 'retryMessage'; userMessageId: string; useCurrentSettings: boolean }
  | { type: 'clearPendingRetry' }
  | { type: 'clearHistoryError' }
  | { type: 'clearHistorySaveError' }
  | { type: 'clearHistoryTrimmed' }
  | { type: 'clearCompactError' }
  | { type: 'appendOutputBatch'; chunks: Array<{ type: 'stdout' | 'stderr'; chunk: string }> };

// ── Conversation context (mirrors src/context/conversationContext.ts) ────────

const CONTEXT_MAX_MESSAGES = 8;
const CONTEXT_CHAR_LIMIT = 12_000;
const ASSISTANT_CONTENT_LIMIT = 2_000;
const RECENT_MESSAGES_AFTER_COMPACT = 6;

function extractAssistantContent(a: AssistantMessage): string {
  return a.lines.filter(l => l.kind === 'stdout').map(l => l.text).join('\n').slice(0, ASSISTANT_CONTENT_LIMIT);
}

/**
 * Builds a conversation context string from the webview state — no race condition
 * with latestHistory because this reads directly from the current React state.
 * Called in handleRun before dispatching sendUserMessage so it captures the state
 * with all completed messages from prior turns.
 *
 * When a compact summary exists, injects it first and includes only messages
 * after the compact point as "recent conversation".
 */
export function buildConversationContextForPrompt(
  state: AppState,
  conversationId: string,
): string | undefined {
  const conv = state.conversations.find(c => c.id === conversationId);
  if (!conv || conv.messages.length === 0) return undefined;

  const completedMessages = conv.messages.filter(
    m => !(m.role === 'assistant' && (m as AssistantMessage).isStreaming),
  );

  if (conv.compactSummary) {
    const { compactSummary } = conv;
    const startIdx = compactSummary.sourceLastMessageId
      ? completedMessages.findIndex(m => m.id === compactSummary.sourceLastMessageId) + 1
      : Math.max(0, completedMessages.length - RECENT_MESSAGES_AFTER_COMPACT);
    const recentMessages = completedMessages.slice(startIdx).slice(-CONTEXT_MAX_MESSAGES);

    const parts: string[] = ['## Compact Conversation Summary', compactSummary.content, ''];

    if (recentMessages.length > 0) {
      parts.push('## Recent Conversation');
      for (const m of recentMessages) {
        if (m.role === 'user') {
          parts.push(`User: ${(m as UserMessage).prompt}`);
        } else {
          parts.push(`Assistant: ${extractAssistantContent(m as AssistantMessage)}`);
        }
      }
    }

    return parts.join('\n');
  }

  const messages = completedMessages.slice(-CONTEXT_MAX_MESSAGES);
  const lines: string[] = [];
  let chars = 0;

  for (const m of messages) {
    let text: string;
    if (m.role === 'user') {
      text = `User: ${(m as UserMessage).prompt}`;
    } else {
      text = `Assistant: ${extractAssistantContent(m as AssistantMessage)}`;
    }
    lines.push(text);
    chars += text.length;
    if (chars >= CONTEXT_CHAR_LIMIT) break;
  }

  return lines.length > 0 ? lines.join('\n') : undefined;
}

/**
 * Serializes completed messages from the active conversation for sending to the
 * extension as part of a compactConversation request.
 */
export function serializeConversationMessagesForCompact(
  state: AppState,
  conversationId: string,
): SerializedChatMessage[] {
  const now = Date.now();
  const conv = state.conversations.find(c => c.id === conversationId);
  if (!conv) return [];

  return conv.messages
    .filter(m => m.role === 'user' || (m.role === 'assistant' && !(m as AssistantMessage).isStreaming))
    .map(m => {
      if (m.role === 'user') {
        const u = m as UserMessage;
        return {
          id: u.id,
          role: 'user' as const,
          prompt: u.prompt,
          provider: u.provider,
          mode: u.mode,
          model: u.model,
          timestamp: u.timestamp,
        };
      }
      const a = m as AssistantMessage;
      const content = a.lines.filter(l => l.kind === 'stdout').map(l => l.text).join('\n');
      return {
        id: a.id,
        role: 'assistant' as const,
        providerLabel: a.providerLabel,
        mode: a.mode,
        model: a.model,
        content,
        exitCode: a.exitCode,
        errorText: a.errorText,
        timestamp: now,
        tokenUsage: a.tokenUsage,
      };
    });
}

// ── History serialization ─────────────────────────────────────────────────

export function serializeHistory(state: AppState): ChatHistoryState {
  const now = Date.now();
  return {
    version: 1,
    activeConversationId: state.activeConvId,
    conversations: state.conversations.map(c => serializeConversation(c, now)),
  };
}

function serializeConversation(c: Conversation, now = Date.now()): SerializedConversation {
  const messages: SerializedChatMessage[] = c.messages
    .filter(m => m.role === 'user' || (m.role === 'assistant' && !(m as AssistantMessage).isStreaming))
    .map(m => {
      if (m.role === 'user') {
        const u = m as UserMessage;
        return {
          id: u.id,
          role: 'user' as const,
          prompt: u.prompt,
          provider: u.provider,
          mode: u.mode,
          model: u.model,
          timestamp: u.timestamp,
        };
      }
      const a = m as AssistantMessage;
      const content = a.lines
        .filter(l => l.kind === 'stdout')
        .map(l => l.text)
        .join('\n');
      return {
        id: a.id,
        role: 'assistant' as const,
        providerLabel: a.providerLabel,
        mode: a.mode,
        model: a.model,
        content,
        exitCode: a.exitCode,
        errorText: a.errorText,
        timestamp: a.timestamp ?? now,
        tokenUsage: a.tokenUsage,
        feedback: a.feedback,
        retrySourceMessageId: a.retrySourceMessageId,
        elapsed: a.elapsed,
      };
    });
  return {
    id: c.id,
    title: c.title,
    createdAt: c.createdAt ?? now,
    updatedAt: c.updatedAt ?? c.createdAt ?? now,
    messages,
    gitChanges: c.gitChanges,
    gitMessage: c.gitMessage,
    compactSummary: c.compactSummary,
  };
}

// ── Runtime deserialization guards ────────────────────────────────────────

const VALID_PROVIDER_IDS: ProviderId[] = ['nexus', 'claude', 'codex', 'antigravity', 'copilot', 'aider', 'custom', 'grok', 'auto'];
const VALID_TASK_MODES: TaskMode[] = ['ask', 'research', 'scan-project', 'plan', 'brainstorm', 'edit', 'debug', 'test', 'review'];

const LEGACY_PROVIDER_LABELS: Record<string, string> = { 'Gemini': 'Antigravity' };
function normalizeLegacyProviderLabel(label: string | undefined): string | undefined {
  if (!label) return label;
  return LEGACY_PROVIDER_LABELS[label] ?? label;
}

function toProviderId(v: unknown): ProviderId {
  if (v === 'gemini') return 'antigravity';
  return VALID_PROVIDER_IDS.includes(v as ProviderId) ? (v as ProviderId) : 'auto';
}

function toTaskMode(v: unknown): TaskMode {
  return VALID_TASK_MODES.includes(v as TaskMode) ? (v as TaskMode) : 'ask';
}

function deserializeConversation(sc: SerializedConversation): Conversation {
  const messages: ChatMessage[] = sc.messages.map(m => {
    if (m.role === 'user') {
      return {
        id: m.id,
        role: 'user' as const,
        prompt: m.prompt,
        provider: toProviderId(m.provider),
        mode: toTaskMode(m.mode),
        model: m.model,
        timestamp: m.timestamp,
      } satisfies UserMessage;
    }
    const lines = m.content
      ? m.content.split('\n').filter(l => l.trim()).map(text => ({ kind: 'stdout' as const, text }))
      : [];
    return {
      id: m.id,
      role: 'assistant' as const,
      providerLabel: normalizeLegacyProviderLabel(m.providerLabel) ?? m.providerLabel ?? '',
      mode: m.mode,
      model: m.model,
      lines,
      isStreaming: false,
      exitCode: m.exitCode,
      errorText: m.errorText,
      steps: [],
      tokenUsage: m.tokenUsage,
      timestamp: m.timestamp ?? 0,
      feedback: m.feedback,
      retrySourceMessageId: m.retrySourceMessageId,
      elapsed: m.elapsed,
    } satisfies AssistantMessage;
  });
  return {
    id: sc.id,
    title: sc.title,
    messages,
    gitChanges: (sc.gitChanges ?? []).map(g => ({ status: g.status, path: g.path })),
    gitMessage: sc.gitMessage,
    createdAt: sc.createdAt,
    updatedAt: sc.updatedAt,
    tokenUsage: aggregateConversationTokenUsage(messages),
    compactSummary: sc.compactSummary,
  };
}

// ── Reducer helpers ───────────────────────────────────────────────────────

/** Sets updatedAt to now and ensures createdAt is initialized. */
function touchConversation(c: Conversation, now = Date.now()): Conversation {
  return { ...c, createdAt: c.createdAt ?? now, updatedAt: now };
}

/**
 * Update one conversation by id. Returns state unchanged if the id is not found.
 * Use for runtime events that must target the conversation that originated the run,
 * not necessarily the currently active (visible) conversation.
 */
function updateConversationById(
  state: AppState,
  conversationId: string,
  update: (c: Conversation) => Conversation,
): AppState {
  let changed = false;
  const conversations = state.conversations.map(c => {
    if (c.id !== conversationId) return c;
    changed = true;
    return update(c);
  });
  if (!changed) return state;
  return { ...state, conversations };
}

function updateActiveConversation(state: AppState, fn: (c: Conversation) => Conversation): AppState {
  return updateConversationById(state, state.activeConvId, fn);
}

// Backward-compat alias — new code should prefer updateActiveConversation or updateConversationById.
const updateActiveConv = updateActiveConversation;

/** Returns the conversation id that should receive runtime task output. */
function getRunConvId(state: AppState): string {
  return state.activeRunConversationId ?? state.activeConvId;
}

function updateLastAssistant(conv: Conversation, fn: (m: AssistantMessage) => AssistantMessage): Conversation {
  const msgs = conv.messages;
  const last = msgs[msgs.length - 1];
  if (!last || last.role !== 'assistant') return conv;
  return { ...conv, messages: [...msgs.slice(0, -1), fn(last as AssistantMessage)] };
}

function completeRunningActivities(conv: Conversation): Conversation {
  return updateLastAssistant(conv, m => ({
    ...m,
    steps: m.steps.map(s => ({
      ...s,
      activities: s.activities.map(a =>
        a.status === 'running' ? { ...a, status: 'done' as const } : a
      ),
    })),
  }));
}

// ── Reducer ───────────────────────────────────────────────────────────────

const MAX_LINES = 2000;
const TRUNCATE_TO = 1900;

/** Caps output lines at MAX_LINES, keeping the most recent TRUNCATE_TO lines. */
function truncateLines(lines: OutputLine[]): OutputLine[] {
  if (lines.length <= MAX_LINES) return lines;
  const dropped = lines.length - TRUNCATE_TO;
  return [
    { kind: 'stdout' as const, text: `[... ${dropped} earlier lines hidden ...]` },
    ...lines.slice(lines.length - TRUNCATE_TO),
  ];
}

export function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'tick':
      return { ...state, elapsed: state.elapsed + 1 };

    case 'stopTask':
      return { ...state, isStopping: true };

    case 'setProvider': {
      const EXCLUDED_AUTO_MODES: TaskMode[] = ['scan-project'];
      const matrix = state.agentCapabilityMatrix;

      const currentFit = matrix.find(
        r => r.agentId === action.value && r.mode === state.mode,
      )?.fit;

      let newMode: TaskMode = state.mode;
      if (matrix.length > 0) {
        if (currentFit === 'unsupported') {
          // Hard fallback: unsupported modes must switch to best, or 'ask' if no best exists
          const bestEntry = matrix.find(
            r => r.agentId === action.value &&
                 r.fit === 'best' &&
                 !EXCLUDED_AUTO_MODES.includes(r.mode),
          );
          newMode = bestEntry ? bestEntry.mode : 'ask';
        } else if (currentFit !== 'best' && currentFit !== 'good' && currentFit !== 'limited') {
          // For unknown/undefined fit, try to find the best mode (soft preference)
          const bestEntry = matrix.find(
            r => r.agentId === action.value &&
                 r.fit === 'best' &&
                 !EXCLUDED_AUTO_MODES.includes(r.mode),
          );
          if (bestEntry) newMode = bestEntry.mode;
        }
        // 'limited' fit: keep the current mode — user chose it intentionally
      }

      return {
        ...state,
        provider: action.value,
        selectedModel: undefined,
        mode: newMode,
        reviewContext: newMode === 'review' ? state.reviewContext : undefined,
        reviewContextError: newMode === 'review' ? state.reviewContextError : undefined,
      };
    }

    case 'setModel':
      return { ...state, selectedModel: action.value };

    case 'setMode':
      return {
        ...state,
        mode: action.value,
        reviewContext: action.value === 'review' ? state.reviewContext : undefined,
        reviewContextError: action.value === 'review' ? state.reviewContextError : undefined,
      };

    case 'toggleHistory':
      return { ...state, showHistory: !state.showHistory };

    case 'toggleSubagents':
      return { ...state, subagentsEnabled: !state.subagentsEnabled };

    case 'resetSubagents':
      return { ...state, subagentsEnabled: false };

    case 'newConversation': {
      const conv = makeConversation();
      return {
        ...state,
        conversations: [conv, ...state.conversations],
        activeConvId: conv.id,
        showHistory: false,
        saveKey: state.saveKey + 1,
      };
    }

    case 'selectConversation':
      return { ...state, activeConvId: action.id, showHistory: false, saveKey: state.saveKey + 1 };

    case 'deleteConversation': {
      const remaining = state.conversations.filter(c => c.id !== action.id);
      const conversations = remaining.length > 0 ? remaining : [makeConversation()];
      const activeConvId = conversations.find(c => c.id === state.activeConvId)
        ? state.activeConvId
        : conversations[0].id;
      return { ...state, conversations, activeConvId, saveKey: state.saveKey + 1 };
    }

    case 'clearHistory': {
      const conv = makeConversation();
      return {
        ...state,
        conversations: [conv],
        activeConvId: conv.id,
        saveKey: state.saveKey + 1,
      };
    }

    case 'sendUserMessage': {
      const runConvId = state.activeConvId;
      const msg: UserMessage = {
        id: uid(),
        role: 'user',
        prompt: action.prompt,
        provider: action.provider,
        mode: action.mode,
        model: action.model,
        timestamp: action.timestamp,
      };
      return {
        ...updateActiveConversation(state, conv => ({
          ...touchConversation(conv, action.timestamp),
          title: conv.messages.length === 0 ? deriveTitle(action.prompt) : conv.title,
          messages: [...conv.messages, msg],
        })),
        activeRunConversationId: runConvId,
        saveKey: state.saveKey + 1,
      };
    }

    case 'setAgentMention':
      return { ...state, agentMention: action.state };

    case 'setSkillMention':
      return { ...state, skillMention: action.state };

    case 'clearConvCompactSummary':
      return {
        ...updateActiveConv(state, conv => ({ ...conv, compactSummary: undefined })),
        saveKey: state.saveKey + 1,
        showCompactInfo: false,
        compactError: undefined,
      };

    case 'toggleCompactInfo':
      return { ...state, showCompactInfo: !state.showCompactInfo };

    case 'setFeedback': {
      let changed = false;
      const conversations = state.conversations.map(c => {
        if (c.id !== action.conversationId) return c;
        const messages = c.messages.map(m => {
          if (m.id !== action.messageId || m.role !== 'assistant') return m;
          changed = true;
          return {
            ...m,
            feedback: { rating: action.rating, ratedAt: Date.now() },
          } as AssistantMessage;
        });
        return { ...c, messages };
      });
      if (!changed) return state;
      return { ...state, conversations, saveKey: state.saveKey + 1 };
    }

    case 'retryMessage': {
      const activeConv = state.conversations.find(c => c.id === state.activeConvId);
      if (!activeConv) return state;
      const userMsg = activeConv.messages.find(m => m.id === action.userMessageId) as UserMessage | undefined;
      if (!userMsg) return state;
      return {
        ...state,
        pendingRetry: {
          prompt: userMsg.prompt,
          provider: userMsg.provider,
          mode: userMsg.mode,
          model: userMsg.model,
          sourceMessageId: action.userMessageId,
          useCurrentSettings: action.useCurrentSettings,
        },
      };
    }

    case 'clearPendingRetry':
      return { ...state, pendingRetry: undefined };

    case 'clearHistoryError':
      return { ...state, historyError: undefined };

    case 'clearHistorySaveError':
      return { ...state, historySaveError: undefined };

    case 'clearHistoryTrimmed':
      return { ...state, historyTrimmedCount: undefined };

    case 'clearCompactError':
      return { ...state, compactError: undefined };

    case 'appendOutputBatch': {
      if (!state.isRunning) return state;
      const allNewLines: OutputLine[] = [];
      for (const item of action.chunks) {
        const lines = item.chunk.split('\n').filter(l => l.trim());
        allNewLines.push(...lines.map(text => ({ kind: item.type as 'stdout' | 'stderr', text })));
      }
      if (allNewLines.length === 0) return state;
      return updateConversationById(state, getRunConvId(state), conv =>
        updateLastAssistant(conv, m => ({
          ...m,
          lines: truncateLines([...m.lines, ...allNewLines]),
        })),
      );
    }

    case 'extMsg':
      return applyExtMsg(state, action.msg);
  }
}

function applyExtMsg(state: AppState, msg: ExtMsg): AppState {
  switch (msg.type) {
    case 'stepStarted': {
      const newStep: PipelineStep = { label: msg.stepLabel, status: 'running', activities: [] };
      if (msg.stepIndex === 0) {
        // First step: create the AssistantMessage shell
        const assistantMsg: AssistantMessage = {
          id: uid(),
          role: 'assistant',
          providerLabel: msg.provider,
          mode: msg.mode,
          model: msg.model,
          lines: [],
          isStreaming: true,
          timestamp: Date.now(),
          steps: [newStep],
        };
        return {
          ...updateConversationById(state, getRunConvId(state), conv => ({
            ...conv,
            messages: [...conv.messages, assistantMsg],
            gitChanges: [],
            gitMessage: undefined,
          })),
          isRunning: true,
          elapsed: 0,
        };
      }
      // Subsequent steps: add to existing streaming message
      return updateConversationById(state, getRunConvId(state), conv =>
        updateLastAssistant(conv, m => ({
          ...m,
          steps: [...m.steps, newStep],
        })),
      );
    }

    case 'stepCompleted':
      return updateConversationById(state, getRunConvId(state), conv =>
        updateLastAssistant(conv, m => ({
          ...m,
          steps: m.steps.map(s =>
            s.label === msg.stepLabel ? { ...s, status: 'done' as const } : s,
          ),
        })),
      );

    case 'stepError':
      return updateConversationById(state, getRunConvId(state), conv =>
        updateLastAssistant(conv, m => ({
          ...m,
          steps: m.steps.map(s =>
            s.label === msg.stepLabel ? { ...s, status: 'error' as const } : s,
          ),
        })),
      );

    case 'taskStarted': {
      const runConvId = getRunConvId(state);
      const runConv = state.conversations.find(c => c.id === runConvId);
      const lastMsg = runConv?.messages[runConv.messages.length - 1];

      // Build EnhancedPromptSnapshot from event data
      let snapshot: EnhancedPromptSnapshot | undefined;
      if (msg.enhancedPrompt) {
        const originalPrompt = (() => {
          const msgs = runConv?.messages ?? [];
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === 'user') return (msgs[i] as UserMessage).prompt;
          }
          return '';
        })();
        snapshot = {
          originalPrompt,
          enhancedPrompt: msg.enhancedPrompt,
          sections: msg.enhancedPromptSections ?? [],
          wasTruncated: false,
          generatedAt: Date.now(),
        };
      }

      // Pipeline mode: AssistantMessage already created by stepStarted — update with snapshot
      if (lastMsg?.role === 'assistant' && (lastMsg as AssistantMessage).isStreaming) {
        return {
          ...updateConversationById(state, runConvId, conv =>
            updateLastAssistant(conv, m => ({
              ...m,
              enhancedPrompt: msg.enhancedPrompt,
              enhancedPromptSnapshot: snapshot,
            })),
          ),
          isRunning: true,
          elapsed: 0,
        };
      }
      // Direct (non-pipeline) mode: create AssistantMessage now
      const assistantMsg: AssistantMessage = {
        id: uid(),
        role: 'assistant',
        providerLabel: msg.provider,
        mode: msg.mode,
        model: msg.model,
        lines: [],
        isStreaming: true,
        timestamp: Date.now(),
        steps: [],
        enhancedPrompt: msg.enhancedPrompt,
        enhancedPromptSnapshot: snapshot,
      };
      return {
        ...updateConversationById(state, runConvId, conv => ({
          ...conv,
          messages: [...conv.messages, assistantMsg],
          gitChanges: [],
          gitMessage: undefined,
        })),
        isRunning: true,
        elapsed: 0,
      };
    }

    case 'stdout': {
      // Drop chunks that arrive after the task has already ended (race condition on stop)
      if (!state.isRunning) return state;
      const lines = msg.chunk.split('\n').filter(l => l.trim());
      return updateConversationById(state, getRunConvId(state), conv =>
        updateLastAssistant(conv, m => ({
          ...m,
          lines: truncateLines([...m.lines, ...lines.map(text => ({ kind: 'stdout' as const, text }))]),
        })),
      );
    }

    case 'stderr': {
      // Drop chunks that arrive after the task has already ended (race condition on stop)
      if (!state.isRunning) return state;
      const lines = msg.chunk.split('\n').filter(l => l.trim());
      return updateConversationById(state, getRunConvId(state), conv =>
        updateLastAssistant(conv, m => ({
          ...m,
          lines: truncateLines([...m.lines, ...lines.map(text => ({ kind: 'stderr' as const, text }))]),
        })),
      );
    }

    case 'taskCompleted':
      return {
        ...updateConversationById(state, getRunConvId(state), conv =>
          touchConversation(completeRunningActivities(
            updateLastAssistant(conv, m => ({ ...m, isStreaming: false, exitCode: msg.exitCode, elapsed: state.elapsed })),
          )),
        ),
        isRunning: false,
        isStopping: false,
        saveKey: state.saveKey + 1,
      };

    case 'taskStopped':
      return {
        ...updateConversationById(state, getRunConvId(state), conv =>
          touchConversation(completeRunningActivities(
            updateLastAssistant(conv, m => ({ ...m, isStreaming: false, elapsed: state.elapsed })),
          )),
        ),
        isRunning: false,
        isStopping: false,
        saveKey: state.saveKey + 1,
      };

    case 'taskError':
      return {
        ...updateConversationById(state, getRunConvId(state), conv =>
          touchConversation(completeRunningActivities(
            updateLastAssistant(conv, m => ({ ...m, isStreaming: false, errorText: msg.message, elapsed: state.elapsed })),
          )),
        ),
        isRunning: false,
        isStopping: false,
        saveKey: state.saveKey + 1,
      };

    case 'gitStatus':
      return updateConversationById(state, getRunConvId(state), conv => ({
        ...conv,
        gitChanges: msg.changes ?? [],
        gitMessage: msg.message,
      }));

    case 'activityStarted': {
      const newActivity: Activity = { kind: msg.activityKind, status: 'running', label: msg.label };
      return updateConversationById(state, getRunConvId(state), conv =>
        updateLastAssistant(conv, m => {
          const steps = m.steps.map((s, i) =>
            i === m.steps.length - 1 && s.status === 'running'
              ? { ...s, activities: [...s.activities, newActivity] }
              : s,
          );
          return { ...m, steps };
        }),
      );
    }

    case 'activityDone': {
      return updateConversationById(state, getRunConvId(state), conv =>
        updateLastAssistant(conv, m => {
          const steps = m.steps.map((s, i) => {
            if (i !== m.steps.length - 1 || s.status !== 'running') return s;
            const activities = [...s.activities];
            let found = false;
            for (let j = activities.length - 1; j >= 0; j--) {
              if (activities[j].label === msg.label && activities[j].status === 'running') {
                activities[j] = { ...activities[j], status: msg.status };
                found = true;
                break;
              }
            }
            // No prior running activity (e.g. agy emits done directly) — add it
            if (!found) {
              activities.push({ kind: msg.activityKind as Activity['kind'], status: msg.status, label: msg.label });
            }
            return { ...s, activities };
          });
          return { ...m, steps };
        }),
      );
    }

    case 'availableProviders': {
      const VALID_PROVIDERS: ProviderId[] = ['nexus', 'codex', 'claude', 'antigravity', 'copilot', 'aider', 'custom', 'grok', 'auto'];
      const normalizedSavedProvider = msg.savedProvider === 'gemini' ? 'antigravity' : msg.savedProvider;
      const restored = normalizedSavedProvider && (VALID_PROVIDERS as string[]).includes(normalizedSavedProvider)
        ? normalizedSavedProvider as ProviderId
        : state.provider;
      return {
        ...state,
        availableProviders: msg.providers,
        providerDetection: msg.detection,
        agentCapabilityMatrix: msg.capabilityMatrix ?? [],
        agentRecommendations: msg.recommendations ?? [],
        needsSetup: msg.needsSetup ?? false,
        isDetecting: false,
        provider: restored,
      };
    }

    case 'historyLoaded': {
      const { history } = msg;
      if (!history || !Array.isArray(history.conversations) || history.conversations.length === 0) {
        return state;
      }
      const conversations = history.conversations.map(deserializeConversation);
      const activeExists = conversations.some(c => c.id === history.activeConversationId);
      const activeConvId = activeExists ? history.activeConversationId : conversations[0].id;
      return { ...state, conversations, activeConvId };
    }

    case 'historyError':
      return { ...state, historyError: msg.message ?? 'Failed to load history' };

    case 'historySaveError':
      return { ...state, historySaveError: msg.message };

    case 'historyTrimmed':
      return { ...state, historyTrimmedCount: msg.removedCount };

    case 'reviewContext':
      return { ...state, reviewContext: msg.context, reviewContextError: undefined };

    case 'reviewContextError':
      return { ...state, reviewContextError: msg.message };

    case 'tokenUsageUpdated':
      return updateConversationById(state, getRunConvId(state), conv => {
        const updated = updateLastAssistant(conv, m => ({
          ...m,
          tokenUsage: msg.usage,
        }));
        return {
          ...updated,
          tokenUsage: aggregateConversationTokenUsage(updated.messages),
        };
      });

    case 'planSaved':
      return updateConversationById(state, getRunConvId(state), conv =>
        updateLastAssistant(conv, m => ({ ...m, planSaved: true, planPath: msg.planPath })),
      );

    case 'mcpStatus':
      return {
        ...state,
        mcpEnabled: msg.enabled,
        mcpActivePresets: msg.presets.filter(p => p.enabled).map(p => p.displayName),
      };

    case 'mcpUsed':
      return {
        ...state,
        lastMcpUsed: { presetId: msg.presetId, presetName: msg.presetName, toolName: msg.toolName },
      };

    case 'agentPrompts':
      return { ...state, agentPrompts: msg.agents };

    case 'agentsReloaded':
      return { ...state, agentPrompts: msg.agents };

    case 'agentPromptError':
      return state;

    case 'skillPrompts':
      return { ...state, skillPrompts: msg.skills };

    case 'skillsReloaded':
      return { ...state, skillPrompts: msg.skills };

    case 'skillPromptError':
      return state;

    case 'compactStarted':
      return { ...state, isCompacting: true, compactError: undefined };

    case 'compactSummaryUpdated': {
      const updated = state.conversations.map(c =>
        c.id === msg.conversationId ? { ...c, compactSummary: msg.summary } : c,
      );
      return {
        ...state,
        conversations: updated,
        isCompacting: false,
        compactError: undefined,
        saveKey: state.saveKey + 1,
      };
    }

    case 'compactSummaryError':
      return { ...state, isCompacting: false, compactError: msg.message };
  }
  return state;
}
