import { useState } from 'react';
import { Tooltip, Popover, PopoverTrigger, PopoverSurface } from '@fluentui/react-components';
import { useT } from '../i18n';
import type {
  AgentModeCapability, AgentModeFit, AgentRecommendation,
  DirectProviderId, ProviderId, ProviderInfo, TaskMode,
} from '../messages';
import { AgentCapabilityMatrix } from './AgentCapabilityMatrix';

interface Props {
  provider: ProviderId;
  mode: TaskMode;
  availableProviders: string[];
  providerDetection: ProviderInfo[];
  matrix: AgentModeCapability[];
  recommendations: AgentRecommendation[];
  disabled?: boolean;
  onProviderChange: (id: ProviderId) => void;
}

type StatusDot = 'ready' | 'warning' | 'unavailable';

const PROVIDER_LABELS: Record<ProviderId, string> = {
  nexus: 'Nexus', auto: 'Auto', antigravity: 'Antigravity',
  codex: 'Codex', claude: 'Claude', copilot: 'Copilot',
  aider: 'Aider', custom: 'Custom', grok: 'Grok',
};

const FIT_ICON: Partial<Record<AgentModeFit, string>> = {
  best: '★', good: '✓', limited: '⚠',
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
  if (!(DIRECT_PROVIDERS as readonly string[]).includes(id)) return undefined;
  return matrix.find(m => m.agentId === (id as DirectProviderId) && m.mode === mode)?.fit;
}

export function AgentChipSelector({
  provider, mode, availableProviders, providerDetection, matrix,
  recommendations, disabled, onProviderChange,
}: Props) {
  const t = useT();
  const [matrixOpen, setMatrixOpen] = useState(false);

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
        const info = providerDetection.find(d => d.id === id);
        const version = info?.version ? ` ${info.version}` : '';
        const fitLabel = fit
          ? ` — ${fitIcon} ${t.agentCapability[fit === 'limited' ? 'limitedFit' : fit] ?? fit}`
          : '';
        const statusLabel = dot === 'ready'
          ? t.provider.statusReady
          : dot === 'warning'
            ? t.provider.statusNotLoggedIn
            : t.provider.statusNotInstalled;
        const tooltipContent = `${label}${version}${fitLabel} · ${statusLabel}`;

        return (
          <Tooltip key={id} content={tooltipContent} relationship="description" withArrow>
            <button
              type="button"
              className="nx-agent-chip"
              data-selected={provider === id ? '' : undefined}
              disabled={disabled}
              onClick={() => onProviderChange(id)}
            >
              {label}
              {fitIcon && <span className="nx-agent-chip-fit" aria-hidden="true">{fitIcon}</span>}
              <span className={`nx-agent-chip-dot nx-agent-chip-dot--${dot}`} aria-hidden="true" />
            </button>
          </Tooltip>
        );
      })}

      <Popover
        open={matrixOpen}
        onOpenChange={(_, d) => setMatrixOpen(d.open)}
        positioning={{ position: 'above', align: 'end' }}
        trapFocus
      >
        <PopoverTrigger disableButtonEnhancement>
          <button
            type="button"
            className="nx-agent-matrix-btn"
            aria-label={t.agentCapability.matrixTitle}
          >
            ?
          </button>
        </PopoverTrigger>
        <PopoverSurface className="nx-agent-matrix-popover-surface">
          <div className="nx-agent-matrix-popover-header">
            <span className="nx-agent-matrix-popover-title">{t.agentCapability.matrixTitle}</span>
            <button
              type="button"
              className="nx-agent-matrix-popover-close"
              onClick={() => setMatrixOpen(false)}
              aria-label={t.agentCapability.closeMatrix}
            >
              ×
            </button>
          </div>
          <AgentCapabilityMatrix
            mode={mode}
            provider={provider}
            availableProviders={availableProviders}
            matrix={matrix}
            recommendations={recommendations}
            onProviderChange={(id) => { onProviderChange(id); setMatrixOpen(false); }}
            compact
          />
        </PopoverSurface>
      </Popover>
    </div>
  );
}
