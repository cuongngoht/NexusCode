import { makeStyles, Button, Tooltip, Option, Select } from '@fluentui/react-components';
import { AddRegular, ClockRegular } from '@fluentui/react-icons';
import type { ProviderId, TaskMode } from '../messages';

const ALL_PROVIDERS: ProviderId[] = ['auto', 'claude', 'codex', 'gemini', 'copilot', 'aider', 'custom'];
const ALL_MODES: TaskMode[] = ['edit', 'debug', 'test', 'refactor', 'research', 'ask'];

interface Props {
  provider: ProviderId;
  mode: TaskMode;
  availableProviders: string[];
  isRunning: boolean;
  showHistory: boolean;
  conversationCount: number;
  onProviderChange: (v: ProviderId) => void;
  onModeChange: (v: TaskMode) => void;
  onNewConversation: () => void;
  onToggleHistory: () => void;
}

const useStyles = makeStyles({
  toolbar: {
    padding: '6px 10px',
    borderBottom: '1px solid var(--vscode-panel-border)',
    background: 'var(--vscode-sideBar-background)',
    flexShrink: '0',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  appName: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--vscode-activityBarBadge-background, #007acc)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    flex: '1',
  },
  iconBtn: {
    minWidth: 'unset',
    padding: '3px',
    height: '22px',
    width: '22px',
    color: 'var(--vscode-icon-foreground)',
    background: 'transparent',
    border: 'none',
    borderRadius: '3px',
    '&:hover': { background: 'var(--vscode-toolbar-hoverBackground)' },
  },
  iconBtnActive: {
    color: 'var(--vscode-activityBarBadge-background, #007acc)',
    background: 'var(--vscode-toolbar-activeBackground)',
  },
  selects: {
    display: 'flex',
    gap: '6px',
    flex: '1',
  },
  select: {
    flex: '1',
    minWidth: '0',
    '& select': {
      background: 'var(--vscode-dropdown-background)',
      color: 'var(--vscode-dropdown-foreground)',
      border: '1px solid var(--vscode-dropdown-border)',
      borderRadius: '3px',
      fontSize: '12px',
      padding: '2px 4px',
      width: '100%',
    },
    '& select:focus': {
      outline: '1px solid var(--vscode-focusBorder)',
      outlineOffset: '0',
    },
  },
});

export function AppToolbar({
  provider, mode, availableProviders, isRunning, showHistory, conversationCount,
  onProviderChange, onModeChange, onNewConversation, onToggleHistory,
}: Props) {
  const styles = useStyles();
  const availableSet = new Set(availableProviders);

  return (
    <div className={styles.toolbar} role="toolbar">
      {/* Top row: title + action buttons */}
      <div className={styles.row}>
        <span className={styles.appName}>Nexus</span>
        <Tooltip content="New conversation" relationship="label">
          <Button
            appearance="subtle"
            size="small"
            icon={<AddRegular />}
            className={styles.iconBtn}
            onClick={onNewConversation}
            disabled={isRunning}
            aria-label="New conversation"
          />
        </Tooltip>
        <Tooltip content={`History (${conversationCount})`} relationship="label">
          <Button
            appearance="subtle"
            size="small"
            icon={<ClockRegular />}
            className={`${styles.iconBtn}${showHistory ? ` ${styles.iconBtnActive}` : ''}`}
            onClick={onToggleHistory}
            aria-label="Toggle conversation history"
            aria-pressed={showHistory}
          />
        </Tooltip>
      </div>

      {/* Bottom row: provider + mode selects */}
      <div className={styles.row}>
        <div className={styles.selects}>
          <Select
            className={styles.select}
            value={provider}
            disabled={isRunning}
            onChange={(_e, d) => onProviderChange(d.value as ProviderId)}
            aria-label="Provider"
          >
            {ALL_PROVIDERS.map(p => {
              const unavailable = p !== 'auto' && p !== 'custom' && availableProviders.length > 0 && !availableSet.has(p);
              return (
                <Option key={p} value={p} disabled={unavailable}>
                  {unavailable ? `${p} (n/a)` : p}
                </Option>
              );
            })}
          </Select>
          <Select
            className={styles.select}
            value={mode}
            disabled={isRunning}
            onChange={(_e, d) => onModeChange(d.value as TaskMode)}
            aria-label="Mode"
          >
            {ALL_MODES.map(m => <Option key={m} value={m}>{m}</Option>)}
          </Select>
        </div>
      </div>
    </div>
  );
}
