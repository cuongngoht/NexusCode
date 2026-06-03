import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { FluentProvider } from '@fluentui/react-components';
import { getBaseTheme } from './theme';
import { reducer, createInitialState, type AppAction, type ExtMsg } from './messages';
import { getVsCodeApi } from './vscodeApi';
import { AppToolbar } from './components/AppToolbar';
import { MessageList } from './components/MessageList';
import { ConversationHistory } from './components/ConversationHistory';
import { Composer } from './components/Composer';
import { I18nContext, LOCALES, type Locale } from './i18n';

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const [locale, setLocale] = useState<Locale>('vi');
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const activeConv = state.conversations.find(c => c.id === state.activeConvId)!;

  useEffect(() => {
    const api = getVsCodeApi();
    const handler = (e: MessageEvent) =>
      dispatch({ type: 'extMsg', msg: e.data as ExtMsg } satisfies AppAction);
    window.addEventListener('message', handler);
    api.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    if (state.isRunning) {
      timerRef.current = setInterval(() => dispatch({ type: 'tick' }), 1000);
    } else {
      clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
    return () => clearInterval(timerRef.current);
  }, [state.isRunning]);

  const handleRun = useCallback(
    (prompt: string) => {
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
      });
    },
    [state.provider, state.mode, state.selectedModel],
  );

  const handleStop = useCallback(() => getVsCodeApi().postMessage({ type: 'stopTask' }), []);
  const handleOpenScm = useCallback(() => getVsCodeApi().postMessage({ type: 'openSourceControl' }), []);
  const handleOpenSettings = useCallback(() => getVsCodeApi().postMessage({ type: 'openSettings' }), []);
  const handleAbout = useCallback(() => getVsCodeApi().postMessage({ type: 'openAbout' }), []);

  return (
    <I18nContext.Provider value={LOCALES[locale]}>
      <FluentProvider theme={getBaseTheme()}>
        <div className="nx-panel">
          <AppToolbar
            provider={state.provider}
            selectedModel={state.selectedModel}
            mode={state.mode}
            availableProviders={state.availableProviders}
            providerDetection={state.providerDetection}
            isRunning={state.isRunning}
            showHistory={state.showHistory}
            conversationCount={state.conversations.length}
            locale={locale}
            onProviderChange={v => dispatch({ type: 'setProvider', value: v })}
            onModelChange={v => dispatch({ type: 'setModel', value: v })}
            onModeChange={v => dispatch({ type: 'setMode', value: v })}
            onNewConversation={() => dispatch({ type: 'newConversation' })}
            onToggleHistory={() => dispatch({ type: 'toggleHistory' })}
            onLocaleChange={setLocale}
            onOpenSettings={handleOpenSettings}
            onAbout={handleAbout}
          />

          {state.showHistory && (
            <ConversationHistory
              conversations={state.conversations}
              activeId={state.activeConvId}
              onSelect={id => dispatch({ type: 'selectConversation', id })}
            />
          )}

          <MessageList
            conversation={activeConv}
            isRunning={state.isRunning}
            onOpenScm={handleOpenScm}
            onCloseGit={() => {
              dispatch({ type: 'extMsg', msg: { type: 'gitStatus', changes: [] } });
            }}
            onSendSuggestion={handleRun}
          />

          <Composer
            isRunning={state.isRunning}
            elapsed={state.elapsed}
            onRun={handleRun}
            onStop={handleStop}
          />
        </div>
      </FluentProvider>
    </I18nContext.Provider>
  );
}
