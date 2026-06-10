import { useRef } from 'react';
import { useT } from '../i18n';
import type { AgentModeCapability, AgentModeFit, AgentRecommendation, DirectProviderId, ProviderId, ProviderInfo, TaskMode } from '../messages';

interface Props {
  provider: ProviderId;
  mode: TaskMode;
  availableProviders: string[];
  providerDetection: ProviderInfo[];
  matrix: AgentModeCapability[];
  recommendations: AgentRecommendation[];
  disabled?: boolean;
  onProviderChange: (id: ProviderId) => void;
  onOpenMatrix: (anchor: HTMLButtonElement) => void;
}

type StatusDot = 'ready' | 'warning' | 'unavailable';

const ABBREV: Record<ProviderId, string> = {
  nexus: 'NX',
  auto: 'AU',
  antigravity: 'AG',
  codex: 'CX',
  claude: 'CL',
  copilot: 'CP',
  aider: 'AI',
  custom: 'CU',
  grok: 'GK',
};

const PROVIDER_LABELS: Record<ProviderId, string> = {
  nexus: 'Nexus',
  auto: 'Auto',
  antigravity: 'Antigravity',
  codex: 'Codex',
  claude: 'Claude',
  copilot: 'Copilot',
  aider: 'Aider',
  custom: 'Custom',
  grok: 'Grok',
};

const FIT_ICON: Partial<Record<AgentModeFit, string>> = {
  best: '★',
  good: '✓',
  limited: '⚠',
};

const DIRECT_PROVIDERS: readonly DirectProviderId[] = [
  'claude', 'codex', 'antigravity', 'copilot', 'aider', 'grok', 'custom',
];

const ALL_PROVIDERS: readonly ProviderId[] = [
  'nexus', 'auto', 'antigravity', 'codex', 'claude', 'copilot', 'aider', 'custom', 'grok',
];

function getStatusDot(id: ProviderId, providerDetection: ProviderInfo[]): StatusDot {
  if (id === 'nexus' || id === 'auto' || id === 'custom') return 'ready';
  const info = providerDetection.find(d => d.id === id);
  if (!info || !info.installed) return 'unavailable';
  if (info.loggedIn === false) return 'warning';
  return 'ready';
}

function getFit(id: ProviderId, mode: TaskMode, matrix: AgentModeCapability[]): AgentModeFit | undefined {
  const isDirect = (DIRECT_PROVIDERS as readonly string[]).includes(id);
  if (!isDirect) return undefined;
  return matrix.find(m => m.agentId === id && m.mode === mode)?.fit;
}

function getStatusLabel(dot: StatusDot, t: ReturnType<typeof useT>): string {
  if (dot === 'ready') return t.provider.statusReady;
  if (dot === 'warning') return t.provider.statusNotLoggedIn;
  return t.provider.statusNotInstalled;
}

export function AgentChipSelector({
  provider, mode, availableProviders, providerDetection, matrix,
  disabled, onProviderChange, onOpenMatrix,
}: Props) {
  const t = useT();
  const matrixBtnRef = useRef<HTMLButtonElement>(null);

  const availableSet = new Set(availableProviders);
  const detectionDone = providerDetection.length > 0;

  const chips = ALL_PROVIDERS.filter(id => {
    if (id === 'nexus' || id === 'auto' || id === 'custom') return true;
    if (!detectionDone) return false;
    return availableSet.has(id);
  });

  return (
    <div className="nx-agent-selector-row">
      {chips.map(id => {
        const dot = getStatusDot(id, providerDetection);
        const fit = getFit(id, mode, matrix);
        const fitIcon = fit ? FIT_ICON[fit] : undefined;
        const label = PROVIDER_LABELS[id] ?? id;
        const statusLabel = getStatusLabel(dot, t);
        const info = providerDetection.find(d => d.id === id);
        const versionSuffix = info?.version ? ` ${info.version}` : '';
        const fitDesc = fit ? ` — ${fitIcon} ${t.agentCapability[fit === 'limited' ? 'limitedFit' : fit] ?? fit}` : '';
        const tooltip = `${label}${versionSuffix}${fitDesc} · ${statusLabel}`;

        return (
          <button
            key={id}
            type="button"
            className="nx-agent-chip"
            data-selected={provider === id ? '' : undefined}
            disabled={disabled}
            title={tooltip}
            onClick={() => onProviderChange(id)}
          >
            {label}
            {fitIcon && <span className="nx-agent-chip-fit" aria-hidden="true">{fitIcon}</span>}
            <span className={`nx-agent-chip-dot nx-agent-chip-dot--${dot}`} aria-hidden="true" />
          </button>
        );
      })}
      <button
        ref={matrixBtnRef}
        type="button"
        className="nx-agent-matrix-btn"
        title={t.agentCapability.matrixTitle}
        onClick={() => matrixBtnRef.current && onOpenMatrix(matrixBtnRef.current)}
      >
        ?
      </button>
    </div>
  );
}
