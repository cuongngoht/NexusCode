import { useMemo, useState } from 'react';
import { interp, useT } from '../i18n';
import type {
  AgentModeCapability,
  AgentModeFit,
  AgentRecommendation,
  DirectProviderId,
  ProviderId,
  TaskMode,
} from '../messages';

interface Props {
  mode: TaskMode;
  provider: ProviderId;
  availableProviders: string[];
  matrix: AgentModeCapability[];
  recommendations: AgentRecommendation[];
  onProviderChange: (provider: ProviderId) => void;
}

const DIRECT_PROVIDERS: readonly DirectProviderId[] = [
  'claude',
  'codex',
  'antigravity',
  'copilot',
  'aider',
  'custom',
  'grok',
];

const MATRIX_MODES: readonly TaskMode[] = [
  'ask',
  'plan',
  'edit',
  'debug',
  'test',
  'review',
];

const PROVIDER_LABELS: Record<DirectProviderId, string> = {
  claude: 'Claude',
  codex: 'Codex',
  antigravity: 'Antigravity',
  copilot: 'Copilot',
  aider: 'Aider',
  custom: 'Custom',
  grok: 'Grok',
};

const FIT_ICON: Record<AgentModeFit, string> = {
  best: '★',
  good: '✓',
  limited: '⚠',
  unsupported: '—',
  unknown: '?',
};

export function AgentCapabilityMatrix({
  mode,
  provider,
  availableProviders,
  matrix,
  recommendations,
  onProviderChange,
}: Props) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  const recommendation = recommendations.find(r => r.mode === mode);
  const modeLabel = modeLabelFor(t.agent.modeLabel, mode);
  const recommendedLabel = recommendation?.recommended
    ? PROVIDER_LABELS[recommendation.recommended]
    : undefined;
  const matrixByKey = useMemo(() => {
    const byKey = new Map<string, AgentModeCapability>();
    for (const capability of matrix) {
      byKey.set(`${capability.agentId}:${capability.mode}`, capability);
    }
    return byKey;
  }, [matrix]);

  const unavailableSet = useMemo(() => {
    if (recommendation) return new Set<string>(recommendation.unavailable);
    const available = new Set(availableProviders);
    return new Set(DIRECT_PROVIDERS.filter(agentId => !available.has(agentId)));
  }, [availableProviders, recommendation]);

  const currentCapability = isDirectProvider(provider)
    ? matrixByKey.get(`${provider}:${mode}`)
    : undefined;
  const showCurrentWarning = currentCapability &&
    currentCapability.fit !== 'best' &&
    currentCapability.fit !== 'good' &&
    provider !== recommendation?.recommended;

  if (matrix.length === 0 || recommendations.length === 0) {
    return null;
  }

  return (
    <div className="nx-agent-capability">
      <div className="nx-agent-capability-summary">
        <div className="nx-agent-capability-copy">
          {recommendedLabel ? (
            <div className="nx-agent-capability-recommendation">
              {interp(t.agentCapability.recommendedFor, {
                mode: modeLabel,
                provider: recommendedLabel,
              })}
            </div>
          ) : (
            <div className="nx-agent-capability-warning">
              {interp(t.agentCapability.noRecommendation, { mode: modeLabel })}
            </div>
          )}
          {recommendation?.alternatives.length ? (
            <div className="nx-agent-capability-muted">
              {interp(t.agentCapability.alsoGood, {
                providers: recommendation.alternatives.map(labelForProvider).join(', '),
              })}
            </div>
          ) : null}
          {recommendation?.limited.length ? (
            <div className="nx-agent-capability-muted">
              {interp(t.agentCapability.limited, {
                providers: recommendation.limited.map(labelForProvider).join(', '),
              })}
            </div>
          ) : null}
          {recommendation?.unavailable.length ? (
            <div className="nx-agent-capability-muted">
              {t.agentCapability.unavailable}: {recommendation.unavailable.map(labelForProvider).join(', ')}
            </div>
          ) : null}
          {showCurrentWarning && (
            <div className="nx-agent-capability-warning" title={currentCapability.reason}>
              {interp(t.agentCapability.currentLimited, {
                provider: labelForProvider(provider),
                mode: modeLabel,
              })}
            </div>
          )}
        </div>

        <div className="nx-agent-capability-actions">
          {recommendation?.recommended && provider !== recommendation.recommended && (
            <button
              type="button"
              onClick={() => onProviderChange(recommendation.recommended as ProviderId)}
            >
              {t.agentCapability.useRecommended}
            </button>
          )}
          <button type="button" onClick={() => setExpanded(v => !v)}>
            {expanded ? t.agentCapability.hideMatrix : t.agentCapability.viewMatrix}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="nx-agent-capability-matrix">
          <table className="nx-agent-capability-table">
            <thead>
              <tr>
                <th>{t.agentCapability.agent}</th>
                {MATRIX_MODES.map(tableMode => (
                  <th key={tableMode}>{modeLabelFor(t.agent.modeLabel, tableMode)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DIRECT_PROVIDERS.map(agentId => {
                const rowClasses = [
                  provider === agentId ? 'nx-agent-capability-provider--selected' : '',
                  recommendation?.recommended === agentId ? 'nx-agent-capability-provider--recommended' : '',
                  unavailableSet.has(agentId) ? 'nx-agent-capability-provider--unavailable' : '',
                ].filter(Boolean).join(' ');
                return (
                  <tr key={agentId} className={rowClasses || undefined}>
                    <th scope="row">{PROVIDER_LABELS[agentId]}</th>
                    {MATRIX_MODES.map(tableMode => {
                      const capability = matrixByKey.get(`${agentId}:${tableMode}`);
                      const fit = capability?.fit ?? 'unknown';
                      return (
                        <td
                          key={tableMode}
                          className={`nx-agent-capability-cell nx-agent-capability-cell--${fit}`}
                          title={capability?.reason}
                        >
                          <span aria-hidden="true">{FIT_ICON[fit]}</span>
                          <span>{fitLabel(t.agentCapability, fit)}</span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function isDirectProvider(provider: ProviderId): provider is DirectProviderId {
  return (DIRECT_PROVIDERS as readonly string[]).includes(provider);
}

function labelForProvider(provider: string): string {
  return PROVIDER_LABELS[provider as DirectProviderId] ?? provider;
}

function modeLabelFor(labels: Record<TaskMode, string>, mode: TaskMode): string {
  return labels[mode] ?? mode;
}

function fitLabel(
  labels: {
    best: string;
    good: string;
    limitedFit: string;
    unsupported: string;
    unknown: string;
  },
  fit: AgentModeFit,
): string {
  if (fit === 'limited') return labels.limitedFit;
  return labels[fit];
}
