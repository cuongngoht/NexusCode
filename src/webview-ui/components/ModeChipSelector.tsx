import { useT } from '../i18n';
import type { AgentModeCapability, DirectProviderId, ProviderId, TaskMode } from '../messages';

interface Props {
  mode: TaskMode;
  provider: ProviderId;
  matrix: AgentModeCapability[];
  disabled?: boolean;
  onModeChange: (mode: TaskMode) => void;
}

const ALL_MODES: readonly TaskMode[] = [
  'ask', 'edit', 'research', 'brainstorm', 'review', 'debug', 'plan', 'test', 'scan-project',
];

const DIRECT_PROVIDERS: readonly string[] = [
  'claude', 'codex', 'antigravity', 'copilot', 'aider', 'custom', 'grok',
];

export function ModeChipSelector({ mode, provider, matrix, disabled, onModeChange }: Props) {
  const t = useT();
  const isDirect = DIRECT_PROVIDERS.includes(provider);

  return (
    <div className="nx-mode-selector-row">
      {ALL_MODES.map(m => {
        const fit = isDirect
          ? matrix.find(cap => cap.agentId === (provider as DirectProviderId) && cap.mode === m)?.fit
          : undefined;
        const isBest = fit === 'best';
        const label = (t.mode as Record<string, { label: string; desc: string }>)[m]?.label ?? m;
        const desc = (t.mode as Record<string, { label: string; desc: string }>)[m]?.desc ?? '';
        const tooltip = fit ? `${label} — ${t.agentCapability[fit === 'limited' ? 'limitedFit' : fit] ?? fit}\n${desc}` : `${label}\n${desc}`;

        return (
          <button
            key={m}
            type="button"
            className="nx-mode-chip"
            data-active={mode === m ? '' : undefined}
            disabled={disabled}
            title={tooltip}
            onClick={() => onModeChange(m)}
          >
            {label}
            {isBest && <span className="nx-mode-chip-fit" aria-hidden="true">★</span>}
          </button>
        );
      })}
    </div>
  );
}
