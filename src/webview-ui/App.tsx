import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { FluentProvider } from '@fluentui/react-components';
import { getBaseTheme } from './theme';
import { reducer, createInitialState, serializeHistory, emptyTokenUsage, buildConversationContextForPrompt, serializeConversationMessagesForCompact, type AppAction, type ExtMsg, type PromptAttachment, type AgentMentionState, type SkillMentionState, type MainView } from './messages';
import { streamStore } from './streamStore';
import { ConversationTokenBar } from './components/ConversationTokenBar';
import { getVsCodeApi } from './vscodeApi';
import { AppToolbar } from './components/AppToolbar';
import { MessageList } from './components/MessageList';
import { ConversationHistory } from './components/ConversationHistory';
import { Composer, type ComposerRef } from './components/Composer';
import { ErrorBanner } from './components/ErrorBanner';
import { I18nContext, LOCALES, interp, type Locale, useT } from './i18n';
import { NexusShell } from './components/layout/NexusShell';
import { uiReducer, createInitialUiState } from './state/uiState';
import { AnalyticsDashboard } from './components/analytics/AnalyticsDashboard';

function getSurface(): MainView {
  return document.body.dataset.nexusSurface === 'dashboard' ? 'dashboard' : 'chat';
}

function SetupBanner({ onOpenSettings }: { onOpenSettings: () => void }) {
  const t = useT();
  return (
    <div className="nx-setup-banner">
      <div className="nx-setup-orb">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      </div>
      <p className="nx-setup-title">{t.setup.title}</p>
      <p className="nx-setup-subtitle">{t.setup.subtitle}</p>
      <button type="button" className="nx-setup-cta" onClick={onOpenSettings}>
        {t.setup.cta}
      </button>
    </div>
  );
}

export function App() {
  const surface = getSurface();
  const isDashboardSurface = surface === 'dashboard';
  const [state, dispatch] = useReducer(reducer, surface, createInitialState);
  const [uiState, dispatchUi] = useReducer(uiReducer, undefined, createInitialUiState);
  const [locale, setLocale] = useState<Locale>(() => {
    const saved = localStorage.getItem('nexus.locale');
    return (saved === 'en' || saved === 'vi') ? saved : 'vi';
  });

  const handleLocaleChange = useCallback((next: Locale) => {
    localStorage.setItem('nexus.locale', next);
    setLocale(next);
  }, []);
  const [composerAttachments, setComposerAttachments] = useState<PromptAttachment[]>([]);
  const [workspaceFiles, setWorkspaceFiles] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const stateRef = useRef(state);
  stateRef.current = state;
  const saveKeyRef = useRef(0);

  // ── Composer ref for focus-return-after-task ──────────────────────────
  const composerRef = useRef<ComposerRef>(null);
  const wasRunning = useRef(false);

  // ── stdout/stderr batch buffer for performance ────────────────────────
  const chunkBuffer = useRef<Array<{ type: 'stdout' | 'stderr'; chunk: string }>>([]);
  const flushScheduled = useRef(false);

  const activeConv = state.conversations.find(c => c.id === state.activeConvId)!;
  const lastEnhancedPrompt = (activeConv?.messages ?? [])
    .filter((m): m is import('./messages').AssistantMessage => m.role === 'assistant')
    .findLast(m => !!m.enhancedPrompt)?.enhancedPrompt;;

  const flushChunks = useCallback(() => {
    flushScheduled.current = false;
    if (chunkBuffer.current.length === 0) return;
    const chunks = chunkBuffer.current.splice(0);
    dispatch({ type: 'appendOutputBatch', chunks });
  }, [dispatch]);

  useEffect(() => {
    const api = getVsCodeApi();
    const handler = (e: MessageEvent) => {
      const msg = e.data as ExtMsg;
      if (msg.type === 'promptAttachmentPicked') {
        setComposerAttachments(prev => [...prev, msg.attachment]);
        return;
      }
      if (msg.type === 'droppedFilesResolved') {
        setComposerAttachments(prev => {
          const existing = new Set(prev.map(a => a.path));
          return [...prev, ...msg.attachments.filter(a => !existing.has(a.path))];
        });
        return;
      }
      if (msg.type === 'workspaceFiles') {
        setWorkspaceFiles(msg.files);
        return;
      }
      if (msg.type === 'agentsReloaded') {
        dispatch({ type: 'extMsg', msg } satisfies AppAction);
        return;
      }
      // Dispatch nexusStreamEvent directly to streamStore — not to the reducer
      if (msg.type === 'nexusStreamEvent') {
        streamStore.dispatch(msg.event);
        return;
      }
      // Batch stdout/stderr for performance — flush via rAF to reduce re-renders
      if (msg.type === 'stdout' || msg.type === 'stderr') {
        chunkBuffer.current.push({ type: msg.type, chunk: msg.chunk });
        if (!flushScheduled.current) {
          flushScheduled.current = true;
          requestAnimationFrame(flushChunks);
        }
        return;
      }
      dispatch({ type: 'extMsg', msg } satisfies AppAction);
    };
    window.addEventListener('message', handler);
    api.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', handler);
  }, [flushChunks]);

  useEffect(() => {
    if (state.isRunning) {
      timerRef.current = setInterval(() => dispatch({ type: 'tick' }), 1000);
    } else {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
    return () => clearInterval(timerRef.current);
  }, [state.isRunning]);

  // Return focus to composer after task ends (9B focus management)
  useEffect(() => {
    if (wasRunning.current && !state.isRunning) {
      composerRef.current?.focus();
    }
    wasRunning.current = state.isRunning;
  }, [state.isRunning]);

  // Autosave history whenever saveKey increments (task done, new/delete/clear conversation, user message)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (state.saveKey > 0 && state.saveKey !== saveKeyRef.current) {
      saveKeyRef.current = state.saveKey;
      getVsCodeApi().postMessage({ type: 'saveHistory', history: serializeHistory(state) });
    }
  }, [state.saveKey]);

  const handleRun = useCallback(
    (prompt: string, baseBranch?: string, attachments?: PromptAttachment[]) => {
      // Snapshot state BEFORE dispatch to capture all completed messages from prior turns.
      // This avoids the race condition where runTask arrives at the extension before the
      // autosave useEffect fires (useEffect runs after browser paint, runTask is sync).
      const currentState = stateRef.current;
      const timestamp = Date.now();
      dispatch({
        type: 'sendUserMessage',
        prompt,
        provider: state.provider,
        mode: state.mode,
        model: state.selectedModel,
        timestamp,
      });
      getVsCodeApi().postMessage({
        type: 'runTask',
        prompt,
        provider: state.provider,
        mode: state.mode,
        model: state.selectedModel,
        conversationId: currentState.activeConvId,
        baseBranch,
        attachments: attachments && attachments.length > 0 ? attachments : undefined,
        subagentsEnabled: state.subagentsEnabled,
        conversationContext: buildConversationContextForPrompt(currentState, currentState.activeConvId),
      });
      setComposerAttachments([]);
      if (state.subagentsEnabled) dispatch({ type: 'resetSubagents' });
    },
    [state.provider, state.mode, state.selectedModel, state.subagentsEnabled, state.activeConvId],
  );

  // Retry: triggered when pendingRetry is set in state by the retryMessage action
  useEffect(() => {
    if (!state.pendingRetry) return;
    const retry = state.pendingRetry;
    dispatch({ type: 'clearPendingRetry' });
    const currentState = stateRef.current;
    const provider = retry.useCurrentSettings ? currentState.provider : retry.provider;
    const mode = retry.useCurrentSettings ? currentState.mode : retry.mode;
    const model = retry.useCurrentSettings ? currentState.selectedModel : retry.model;
    const timestamp = Date.now();
    dispatch({
      type: 'sendUserMessage',
      prompt: retry.prompt,
      provider,
      mode,
      model,
      timestamp,
    });
    getVsCodeApi().postMessage({
      type: 'runTask',
      prompt: retry.prompt,
      provider,
      mode,
      model,
      conversationId: currentState.activeConvId,
      subagentsEnabled: currentState.subagentsEnabled,
      conversationContext: buildConversationContextForPrompt(currentState, currentState.activeConvId),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.pendingRetry]);

  const handleFeedback = useCallback(
    (conversationId: string, messageId: string, rating: 'good' | 'bad' | null) => {
      dispatch({ type: 'setFeedback', conversationId, messageId, rating });
      // Also submit to analytics service if there's a taskId on the message
      if (rating !== null) {
        const conv = stateRef.current.conversations.find(c => c.id === conversationId);
        const msg = conv?.messages.find(m => m.id === messageId);
        const taskId = msg && msg.role === 'assistant'
          ? (msg as import('./messages').AssistantMessage).taskId
          : undefined;
        if (taskId) {
          getVsCodeApi().postMessage({
            type: 'submitRunFeedback',
            taskId,
            feedback: rating,
          });
        }
      }
    },
    [],
  );

  const handleRetry = useCallback(
    (userMessageId: string, useCurrentSettings: boolean) => {
      dispatch({ type: 'retryMessage', userMessageId, useCurrentSettings });
    },
    [],
  );

  const handleStop = useCallback(() => {
    dispatch({ type: 'stopTask' });
    getVsCodeApi().postMessage({ type: 'stopTask' });
  }, []);
  const handleOpenScm = useCallback(() => getVsCodeApi().postMessage({ type: 'openSourceControl' }), []);
  const handleOpenSettings = useCallback(() => getVsCodeApi().postMessage({ type: 'openSettings' }), []);
  const handleAbout = useCallback(() => getVsCodeApi().postMessage({ type: 'openAbout' }), []);

  const handleOpenFile = useCallback((p: string) =>
    getVsCodeApi().postMessage({ type: 'openWorkspaceFile', path: p }), []);

  const handleAttachFiles = useCallback((paths: string[]) =>
    getVsCodeApi().postMessage({ type: 'attachWorkspaceFiles', paths }), []);

  const handleRefreshReviewContext = useCallback((baseBranch?: string) => {
    getVsCodeApi().postMessage({ type: 'getReviewContext', baseBranch });
  }, []);

  const handleOpenReviewAgentFile = useCallback(() => {
    getVsCodeApi().postMessage({ type: 'openReviewAgentFile' });
  }, []);

  const handleReloadAgents = useCallback(() => {
    getVsCodeApi().postMessage({ type: 'reloadAgents' });
  }, []);

  const handleAgentMentionChange = useCallback((mentionState: AgentMentionState | undefined) => {
    dispatch({ type: 'setAgentMention', state: mentionState });
  }, []);

  const handleReloadSkills = useCallback(() => {
    getVsCodeApi().postMessage({ type: 'reloadSkills' });
  }, []);

  const handleResearchCommand = useCallback(
    (action: 'done' | 'current' | 'next' | 'list' | 'reload') => {
      getVsCodeApi().postMessage({ type: 'researchCommand', action });
    },
    [],
  );

  const handleCompactCommand = useCallback(
    (action: 'compact' | 'show' | 'clear') => {
      const currentState = stateRef.current;
      if (action === 'compact') {
        const messages = serializeConversationMessagesForCompact(currentState, currentState.activeConvId);
        if (messages.length === 0) return;
        getVsCodeApi().postMessage({
          type: 'compactConversation',
          conversationId: currentState.activeConvId,
          messages,
          provider: currentState.provider,
          model: currentState.selectedModel,
        });
      } else if (action === 'show') {
        dispatch({ type: 'toggleCompactInfo' });
      } else if (action === 'clear') {
        dispatch({ type: 'clearConvCompactSummary' });
      }
    },
    [],
  );

  const handleSkillMentionChange = useCallback((mentionState: SkillMentionState | undefined) => {
    dispatch({ type: 'setSkillMention', state: mentionState });
  }, []);

  useEffect(() => {
    if (state.mode === 'review' && !state.isDetecting) {
      getVsCodeApi().postMessage({ type: 'getReviewContext' });
    }
  }, [state.mode, state.isDetecting]);

  return (
    <I18nContext.Provider value={LOCALES[locale]}>
      <FluentProvider theme={getBaseTheme()}>
        <div className="nx-panel" role="main">
          {/* Screen-reader status announcements (9D) */}
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {state.isRunning
              ? interp(LOCALES[locale].composer.working, { elapsed: String(state.elapsed) })
              : state.isStopping
                ? LOCALES[locale].composer.stopping
                : ''}
          </div>
          <NexusShell uiState={uiState} onUiAction={dispatchUi}>
          {isDashboardSurface ? (
            <AnalyticsDashboard
              summary={state.analyticsSummary}
              runs={state.analyticsRuns}
              loading={state.analyticsLoading}
              error={state.analyticsError}
              dispatch={dispatch}
            />
          ) : (
            <>
              <AppToolbar
                isRunning={state.isRunning}
                showHistory={state.showHistory}
                conversationCount={state.conversations.length}
                locale={locale}
                onNewConversation={() => dispatch({ type: 'newConversation' })}
                onToggleHistory={() => dispatch({ type: 'toggleHistory' })}
                onLocaleChange={handleLocaleChange}
                onOpenSettings={handleOpenSettings}
                onAbout={handleAbout}
              />

              {state.showHistory && (
                <ConversationHistory
                  conversations={state.conversations}
                  activeId={state.activeConvId}
                  onSelect={id => dispatch({ type: 'selectConversation', id })}
                  onDelete={id => dispatch({ type: 'deleteConversation', id })}
                  onClearAll={() => dispatch({ type: 'clearHistory' })}
                />
              )}

              {state.needsSetup && !state.isDetecting ? (
                <SetupBanner onOpenSettings={handleOpenSettings} />
              ) : (
                <div className="nx-chat-area">
              {!state.isDetecting && (
                <div className="nx-mcp-chip">
                  {state.mcpEnabled
                    ? (state.mcpActivePresets.length > 0
                      ? `MCP: ${state.mcpActivePresets.join(' + ')}`
                      : 'MCP: On (no presets)')
                    : 'MCP: Off'}
                  {state.lastMcpUsed && (
                    <span className="nx-mcp-used">
                      {` Used: ${state.lastMcpUsed.presetName} / ${state.lastMcpUsed.toolName}`}
                    </span>
                  )}
                </div>
              )}
              {state.historyError && (
                <ErrorBanner
                  severity="error"
                  message={interp(LOCALES[locale].history.saveError, { message: state.historyError })}
                  onDismiss={() => dispatch({ type: 'clearHistoryError' })}
                />
              )}
              {state.historySaveError && (
                <ErrorBanner
                  severity="warning"
                  message={interp(LOCALES[locale].history.saveError, { message: state.historySaveError })}
                  onDismiss={() => dispatch({ type: 'clearHistorySaveError' })}
                />
              )}
              {state.historyTrimmedCount != null && state.historyTrimmedCount > 0 && (
                <ErrorBanner
                  severity="info"
                  message={interp(LOCALES[locale].history.trimmed, { count: state.historyTrimmedCount })}
                  onDismiss={() => dispatch({ type: 'clearHistoryTrimmed' })}
                />
              )}
              {state.isCompacting && (
                <div className="nx-history-trim-info" role="status">
                  {LOCALES[locale].compact.compacting}
                </div>
              )}
              {state.compactError && (
                <ErrorBanner
                  severity="error"
                  message={interp(LOCALES[locale].compact.error, { message: state.compactError })}
                  onDismiss={() => dispatch({ type: 'clearCompactError' })}
                />
              )}
              {!state.isDetecting && state.availableProviders.length === 0 && (
                <ErrorBanner
                  severity="info"
                  message={LOCALES[locale].errors.noAgentsInstalled}
                  action={{ label: LOCALES[locale].toolbar.settings, onClick: handleOpenSettings }}
                />
              )}
              {!state.isDetecting && (() => {
                const currentProvider = state.providerDetection.find(p => p.id === state.provider);
                if (
                  currentProvider?.installed &&
                  (currentProvider.authStatus === 'unauthenticated' || currentProvider.loggedIn === false) &&
                  currentProvider.loginCommand
                ) {
                  return (
                    <ErrorBanner
                      severity="warning"
                      message={interp(LOCALES[locale].errors.providerNotAuthenticated, { provider: currentProvider.displayName })}
                      action={{
                        label: LOCALES[locale].errors.loginAction,
                        onClick: () => getVsCodeApi().postMessage({ type: 'loginProvider', providerId: state.provider }),
                      }}
                    />
                  );
                }
                return null;
              })()}
              {activeConv?.compactSummary && (
                <div className="nx-compact-card" role="status">
                  <div className="nx-compact-card-header">
                    <span className="nx-compact-card-title">
                      ✓ {LOCALES[locale].compact.summaryTitle}
                    </span>
                    <span className="nx-compact-card-meta">
                      {interp(LOCALES[locale].compact.summaryOf, { n: activeConv.compactSummary.sourceMessageCount })}
                    </span>
                    <span className="nx-compact-card-date">
                      {new Date(activeConv.compactSummary.createdAt).toLocaleString()}
                    </span>
                    <div className="nx-compact-card-actions">
                      <button
                        type="button"
                        className="nx-compact-card-btn"
                        onClick={() => handleCompactCommand('show')}
                      >
                        {state.showCompactInfo
                          ? LOCALES[locale].compact.hideSummary
                          : LOCALES[locale].compact.showSummary}
                      </button>
                      <button
                        type="button"
                        className="nx-compact-card-btn nx-compact-card-btn--clear"
                        onClick={() => handleCompactCommand('clear')}
                      >
                        {LOCALES[locale].compact.clearCompact}
                      </button>
                    </div>
                  </div>
                  {state.showCompactInfo && (
                    <pre className="nx-compact-info-content">{activeConv.compactSummary.content}</pre>
                  )}
                </div>
              )}

              <MessageList
                conversation={state.isDetecting ? { id: '', title: '', messages: [], gitChanges: [], tokenUsage: emptyTokenUsage() } : activeConv}
                isRunning={state.isRunning}
                providerDetection={state.providerDetection}
                availableProviders={state.availableProviders}
                onOpenScm={handleOpenScm}
                onCloseGit={() => {
                  dispatch({ type: 'extMsg', msg: { type: 'gitStatus', changes: [] } });
                }}
                onSendSuggestion={handleRun}
                onOpenFile={handleOpenFile}
                onAttachFiles={handleAttachFiles}
                onFeedback={handleFeedback}
                onRetry={handleRetry}
              />

              {!state.isDetecting && (
                <ConversationTokenBar
                  usage={activeConv.tokenUsage}
                  isRunning={state.isRunning}
                  enhancedPrompt={lastEnhancedPrompt}
                  onCompact={() => handleCompactCommand('compact')}
                />
              )}

              {!state.isDetecting &&
                !state.isCompacting &&
                !activeConv?.compactSummary &&
                (activeConv?.messages?.length ?? 0) > 8 && (
                <div className="nx-long-conv-hint">
                  {LOCALES[locale].compact.longConversationHint}
                  {' '}
                  <button
                    type="button"
                    className="nx-long-conv-hint-btn"
                    onClick={() => handleCompactCommand('compact')}
                  >
                    {LOCALES[locale].compact.compactAction}
                  </button>
                </div>
              )}

              {!state.isDetecting && (
                <Composer
                  ref={composerRef}
                  isRunning={state.isRunning}
                  isStopping={state.isStopping}
                  elapsed={state.elapsed}
                  provider={state.provider}
                  mode={state.mode}
                  availableProviders={state.availableProviders}
                  providerDetection={state.providerDetection}
                  agentCapabilityMatrix={state.agentCapabilityMatrix}
                  agentRecommendations={state.agentRecommendations}
                  reviewContext={state.reviewContext}
                  reviewContextError={state.reviewContextError}
                  attachments={composerAttachments}
                  onAttachmentsChange={setComposerAttachments}
                  workspaceFiles={workspaceFiles}
                  onRequestWorkspaceFiles={() => getVsCodeApi().postMessage({ type: 'getWorkspaceFiles' })}
                  onRun={handleRun}
                  onStop={handleStop}
                  onProviderChange={v => {
                    dispatch({ type: 'setProvider', value: v });
                    getVsCodeApi().postMessage({ type: 'saveProvider', provider: v });
                  }}
                  onModeChange={v => dispatch({ type: 'setMode', value: v })}
                  onRefreshReviewContext={handleRefreshReviewContext}
                  onOpenReviewAgentFile={handleOpenReviewAgentFile}
                  subagentsEnabled={state.subagentsEnabled}
                  onToggleSubagents={() => dispatch({ type: 'toggleSubagents' })}
                  onLoginProvider={id => getVsCodeApi().postMessage({ type: 'loginProvider', providerId: id })}
                  onResolveDroppedFiles={paths => getVsCodeApi().postMessage({ type: 'resolveDroppedFiles', paths })}
                  agentPrompts={state.agentPrompts}
                  agentMention={state.agentMention}
                  onAgentMentionChange={handleAgentMentionChange}
                  onReloadAgents={handleReloadAgents}
                  skillPrompts={state.skillPrompts}
                  skillMention={state.skillMention}
                  onSkillMentionChange={handleSkillMentionChange}
                  onReloadSkills={handleReloadSkills}
                  onResearchCommand={handleResearchCommand}
                  onCompactCommand={handleCompactCommand}
                />
              )}
                </div>
              )}
            </>
          )}
          </NexusShell>
        </div>
      </FluentProvider>
    </I18nContext.Provider>
  );
}
