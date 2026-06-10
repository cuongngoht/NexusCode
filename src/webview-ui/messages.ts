import type {
  ChatHistoryState,
  SerializedConversation,
  SerializedChatMessage,
} from '../core/chat/ChatHistory';
import type {
  TokenRunUsage,
  ConversationTokenUsage,
  ProviderTokenSummary,
  TokenUsageSource,
} from '../core/tokens/TokenUsage';

export type { ChatHistoryState };

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

export interface UserMessage {
  id: string;
  role: 'user';
  prompt: string;
  provider: ProviderId;
  mode: TaskMode;
  model?: string;
  timestamp: number;
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
  exitCode?: number;
  errorText?: string;
  steps: PipelineStep[];
  tokenUsage?: TokenRunUsage;
  enhancedPrompt?: string;
  planSaved?: boolean;
  planPath?: string;
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

export interface AppState {
  conversations: Conversation[];
  activeConvId: string;
  isRunning: boolean;
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
  mcpEnabled: boolean;
  mcpActivePresets: string[];
  lastMcpUsed?: { presetId: string; presetName: string; toolName: string };
  subagentsEnabled: boolean;
}

export function createInitialState(): AppState {
  const conv = makeConversation();
  return {
    conversations: [conv],
    activeConvId: conv.id,
    isRunning: false,
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
    mcpEnabled: false,
    mcpActivePresets: [],
    lastMcpUsed: undefined,
    subagentsEnabled: false,
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
  loggedIn?: boolean;
  loginCommand?: string;
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
  | { type: 'taskStarted'; taskId: string; provider: string; mode: string; model?: string; enhancedPrompt?: string }
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
  | { type: 'mcpUsed'; presetId: string; presetName: string; toolName: string };

// ── Actions ───────────────────────────────────────────────────────────────

export type AppAction =
  | { type: 'extMsg'; msg: ExtMsg }
  | { type: 'tick' }
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
  };

// ── History serialization ─────────────────────────────────────────────────

export function serializeHistory(state: AppState): ChatHistoryState {
  const now = Date.now();
  return {
    version: 1,
    activeConversationId: state.activeConvId,
    conversations: state.conversations.map(c => serializeConversation(c, now)),
  };
}

function serializeConversation(c: Conversation, now: number): SerializedConversation {
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
        timestamp: now,
        tokenUsage: a.tokenUsage,
      };
    });
  return {
    id: c.id,
    title: c.title,
    createdAt: c.createdAt ?? now,
    updatedAt: now,
    messages,
    gitChanges: c.gitChanges,
    gitMessage: c.gitMessage,
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
  };
}

// ── Reducer helpers ───────────────────────────────────────────────────────

function updateActiveConv(state: AppState, fn: (c: Conversation) => Conversation): AppState {
  return {
    ...state,
    conversations: state.conversations.map(c =>
      c.id === state.activeConvId ? fn(c) : c,
    ),
  };
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

export function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'tick':
      return { ...state, elapsed: state.elapsed + 1 };

    case 'setProvider': {
      const EXCLUDED_AUTO_MODES: TaskMode[] = ['scan-project'];
      const matrix = state.agentCapabilityMatrix;

      const currentFit = matrix.find(
        r => r.agentId === action.value && r.mode === state.mode,
      )?.fit;

      let newMode: TaskMode = state.mode;
      if (currentFit !== 'best' && currentFit !== 'good' && matrix.length > 0) {
        const bestEntry = matrix.find(
          r => r.agentId === action.value &&
               r.fit === 'best' &&
               !EXCLUDED_AUTO_MODES.includes(r.mode),
        );
        if (bestEntry) newMode = bestEntry.mode;
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
      return { ...state, activeConvId: action.id, showHistory: false };

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
        ...updateActiveConv(state, conv => ({
          ...conv,
          title: conv.messages.length === 0 ? deriveTitle(action.prompt) : conv.title,
          messages: [...conv.messages, msg],
        })),
        saveKey: state.saveKey + 1,
      };
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
          steps: [newStep],
        };
        return {
          ...updateActiveConv(state, conv => ({
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
      return updateActiveConv(state, conv =>
        updateLastAssistant(conv, m => ({
          ...m,
          steps: [...m.steps, newStep],
        })),
      );
    }

    case 'stepCompleted':
      return updateActiveConv(state, conv =>
        updateLastAssistant(conv, m => ({
          ...m,
          steps: m.steps.map(s =>
            s.label === msg.stepLabel ? { ...s, status: 'done' as const } : s,
          ),
        })),
      );

    case 'stepError':
      return updateActiveConv(state, conv =>
        updateLastAssistant(conv, m => ({
          ...m,
          steps: m.steps.map(s =>
            s.label === msg.stepLabel ? { ...s, status: 'error' as const } : s,
          ),
        })),
      );

    case 'taskStarted': {
      const activeConv = state.conversations.find(c => c.id === state.activeConvId);
      const lastMsg = activeConv?.messages[activeConv.messages.length - 1];
      // Pipeline mode: AssistantMessage already created by stepStarted — store enhancedPrompt
      if (lastMsg?.role === 'assistant' && lastMsg.isStreaming) {
        return {
          ...updateActiveConv(state, conv =>
            updateLastAssistant(conv, m => ({ ...m, enhancedPrompt: msg.enhancedPrompt })),
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
        steps: [],
        enhancedPrompt: msg.enhancedPrompt,
      };
      return {
        ...updateActiveConv(state, conv => ({
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
      const lines = msg.chunk.split('\n').filter(l => l.trim());
      return updateActiveConv(state, conv =>
        updateLastAssistant(conv, m => ({
          ...m,
          lines: [...m.lines, ...lines.map(text => ({ kind: 'stdout' as const, text }))],
        })),
      );
    }

    case 'stderr': {
      const lines = msg.chunk.split('\n').filter(l => l.trim());
      return updateActiveConv(state, conv =>
        updateLastAssistant(conv, m => ({
          ...m,
          lines: [...m.lines, ...lines.map(text => ({ kind: 'stderr' as const, text }))],
        })),
      );
    }

    case 'taskCompleted':
      return {
        ...updateActiveConv(state, conv =>
          completeRunningActivities(
            updateLastAssistant(conv, m => ({ ...m, isStreaming: false, exitCode: msg.exitCode })),
          ),
        ),
        isRunning: false,
        saveKey: state.saveKey + 1,
      };

    case 'taskStopped':
      return {
        ...updateActiveConv(state, conv =>
          completeRunningActivities(
            updateLastAssistant(conv, m => ({ ...m, isStreaming: false })),
          ),
        ),
        isRunning: false,
        saveKey: state.saveKey + 1,
      };

    case 'taskError':
      return {
        ...updateActiveConv(state, conv =>
          completeRunningActivities(
            updateLastAssistant(conv, m => ({ ...m, isStreaming: false, errorText: msg.message })),
          ),
        ),
        isRunning: false,
        saveKey: state.saveKey + 1,
      };

    case 'gitStatus':
      return updateActiveConv(state, conv => ({
        ...conv,
        gitChanges: msg.changes ?? [],
        gitMessage: msg.message,
      }));

    case 'activityStarted': {
      const newActivity: Activity = { kind: msg.activityKind, status: 'running', label: msg.label };
      return updateActiveConv(state, conv =>
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
      return updateActiveConv(state, conv =>
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

    case 'reviewContext':
      return { ...state, reviewContext: msg.context, reviewContextError: undefined };

    case 'reviewContextError':
      return { ...state, reviewContextError: msg.message };

    case 'tokenUsageUpdated':
      return updateActiveConv(state, conv => {
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
      return updateActiveConv(state, conv =>
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
  }
  return state;
}
