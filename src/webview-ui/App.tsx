import { useCallback, useEffect, useReducer, useRef } from 'react';
import { FluentProvider, makeStyles, Spinner, Text } from '@fluentui/react-components';
import { getBaseTheme } from './theme';
import { reducer, createInitialState, type AppAction, type ExtMsg } from './messages';
import { getVsCodeApi } from './vscodeApi';
import { AppToolbar } from './components/AppToolbar';
import { MessageList } from './components/MessageList';
import { ConversationHistory } from './components/ConversationHistory';
import { Composer } from './components/Composer';

const useStyles = makeStyles({
  shell: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
    backgroundColor: 'var(--vscode-editor-background)',
    color: 'var(--vscode-editor-foreground)',
    fontFamily: 'var(--vscode-font-family)',
    fontSize: 'var(--vscode-font-size)',
  },
  statusBar: {
    padding: '2px 10px',
    flexShrink: '0',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    borderTop: '1px solid var(--vscode-panel-border)',
    background: 'var(--vscode-statusBar-background, var(--vscode-sideBar-background))',
    minHeight: '22px',
  },
});

export function App() {
  const styles = useStyles();
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
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
      dispatch({ type: 'sendUserMessage', prompt, provider: state.provider, mode: state.mode, timestamp });
      getVsCodeApi().postMessage({ type: 'runTask', prompt, provider: state.provider, mode: state.mode });
    },
    [state.provider, state.mode],
  );

  const handleStop = useCallback(() => getVsCodeApi().postMessage({ type: 'stopTask' }), []);
  const handleOpenScm = useCallback(() => getVsCodeApi().postMessage({ type: 'openSourceControl' }), []);

  return (
    <FluentProvider theme={getBaseTheme()}>
      <div className={styles.shell}>
        <AppToolbar
          provider={state.provider}
          mode={state.mode}
          availableProviders={state.availableProviders}
          providerDetection={state.providerDetection}
          isRunning={state.isRunning}
          showHistory={state.showHistory}
          conversationCount={state.conversations.length}
          onProviderChange={v => dispatch({ type: 'setProvider', value: v })}
          onModeChange={v => dispatch({ type: 'setMode', value: v })}
          onNewConversation={() => dispatch({ type: 'newConversation' })}
          onToggleHistory={() => dispatch({ type: 'toggleHistory' })}
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
          onOpenScm={handleOpenScm}
          onCloseGit={() => {
            // clear git panel by resetting changes in the active conversation
            dispatch({ type: 'extMsg', msg: { type: 'gitStatus', changes: [] } });
          }}
        />

        {state.isRunning && (
          <div className={styles.statusBar} role="status" aria-live="polite">
            <Spinner size="extra-tiny" />
            <Text size={100} style={{ color: 'var(--vscode-descriptionForeground)', fontSize: '11px' }}>
              {state.elapsed}s
            </Text>
          </div>
        )}

        <Composer isRunning={state.isRunning} onRun={handleRun} onStop={handleStop} />
      </div>
    </FluentProvider>
  );
}
