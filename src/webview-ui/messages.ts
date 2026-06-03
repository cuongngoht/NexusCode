export type ProviderId = 'codex' | 'claude' | 'gemini' | 'copilot' | 'aider' | 'custom' | 'auto';
export type TaskMode =
  | 'ask'
  | 'research'
  | 'scan-project'
  | 'plan'
  | 'edit'
  | 'debug'
  | 'test'
  | 'review';

export type ProviderModelSource = 'detected' | 'seeded';

export interface ProviderModel {
  id: string;
  label: string;
  source: ProviderModelSource;
}

export interface GitChange { status: string; path: string; }

let _seq = 0;
const uid = () => `${++_seq}`;

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

export interface PipelineStep {
  label: string;
  status: 'running' | 'done' | 'error';
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
}

export type ChatMessage = UserMessage | AssistantMessage;

// ── Conversation ──────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  gitChanges: GitChange[];
  gitMessage?: string;
}

function makeConversation(): Conversation {
  return { id: uid(), title: 'New conversation', messages: [], gitChanges: [] };
}

// ── App state ─────────────────────────────────────────────────────────────

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
  showHistory: boolean;
}

export function createInitialState(): AppState {
  const conv = makeConversation();
  return {
    conversations: [conv],
    activeConvId: conv.id,
    isRunning: false,
    elapsed: 0,
    provider: 'auto',
    selectedModel: undefined,
    mode: 'ask',
    availableProviders: [],
    providerDetection: [],
    showHistory: false,
  };
}

// ── Extension → webview messages ──────────────────────────────────────────

export interface ProviderInfo {
  id: string;
  displayName: string;
  cliLabel: string;
  installed: boolean;
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
  | { type: 'taskStarted'; taskId: string; provider: string; mode: string; model?: string }
  | { type: 'taskCompleted'; taskId: string; exitCode: number }
  | { type: 'taskStopped'; taskId: string }
  | { type: 'taskError'; taskId: string; message: string }
  | { type: 'gitStatus'; changes: GitChange[]; message?: string }
  | { type: 'availableProviders'; providers: string[]; detection: ProviderInfo[] }
  | { type: 'stepStarted'; stepLabel: string; stepIndex: number; totalSteps: number; provider: string; mode: string; model?: string }
  | { type: 'stepCompleted'; stepLabel: string }
  | { type: 'stepError'; stepLabel: string; error: string };

// ── Actions ───────────────────────────────────────────────────────────────

export type AppAction =
  | { type: 'extMsg'; msg: ExtMsg }
  | { type: 'tick' }
  | { type: 'setProvider'; value: ProviderId }
  | { type: 'setModel'; value?: string }
  | { type: 'setMode'; value: TaskMode }
  | { type: 'toggleHistory' }
  | { type: 'newConversation' }
  | { type: 'selectConversation'; id: string }
  | {
      type: 'sendUserMessage';
      prompt: string;
      provider: ProviderId;
      mode: TaskMode;
      model?: string;
      timestamp: number;
    };

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

// ── Reducer ───────────────────────────────────────────────────────────────

export function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'tick':
      return { ...state, elapsed: state.elapsed + 1 };

    case 'setProvider':
      return { ...state, provider: action.value, selectedModel: undefined };

    case 'setModel':
      return { ...state, selectedModel: action.value };

    case 'setMode':
      return { ...state, mode: action.value };

    case 'toggleHistory':
      return { ...state, showHistory: !state.showHistory };

    case 'newConversation': {
      const conv = makeConversation();
      return {
        ...state,
        conversations: [conv, ...state.conversations],
        activeConvId: conv.id,
        showHistory: false,
      };
    }

    case 'selectConversation':
      return { ...state, activeConvId: action.id, showHistory: false };

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
      return updateActiveConv(state, conv => ({
        ...conv,
        title: conv.messages.length === 0 ? action.prompt.slice(0, 50).trim() : conv.title,
        messages: [...conv.messages, msg],
      }));
    }

    case 'extMsg':
      return applyExtMsg(state, action.msg);
  }
}

function applyExtMsg(state: AppState, msg: ExtMsg): AppState {
  switch (msg.type) {
    case 'stepStarted': {
      const newStep: PipelineStep = { label: msg.stepLabel, status: 'running' };
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
      // Pipeline mode: AssistantMessage already created by stepStarted — don't duplicate
      if (lastMsg?.role === 'assistant' && lastMsg.isStreaming) {
        return { ...state, isRunning: true, elapsed: 0 };
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
          updateLastAssistant(conv, m => ({ ...m, isStreaming: false, exitCode: msg.exitCode })),
        ),
        isRunning: false,
      };

    case 'taskStopped':
      return {
        ...updateActiveConv(state, conv =>
          updateLastAssistant(conv, m => ({ ...m, isStreaming: false })),
        ),
        isRunning: false,
      };

    case 'taskError':
      return {
        ...updateActiveConv(state, conv =>
          updateLastAssistant(conv, m => ({ ...m, isStreaming: false, errorText: msg.message })),
        ),
        isRunning: false,
      };

    case 'gitStatus':
      return updateActiveConv(state, conv => ({
        ...conv,
        gitChanges: msg.changes ?? [],
        gitMessage: msg.message,
      }));

    case 'availableProviders':
      return { ...state, availableProviders: msg.providers, providerDetection: msg.detection };
  }
}
