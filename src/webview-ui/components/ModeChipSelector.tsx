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
  'ask', 'edit', 'agent', 'research', 'brainstorm', 'review', 'debug', 'plan', 'test', 'scan-project',
];

const DIRECT_PROVIDERS: readonly string[] = [
  'claude', 'codex', 'antigravity', 'copilot', 'aider', 'custom', 'grok',
];

type RiskLevel = 'readonly' | 'plan' | 'mutate';

const MODE_RISK: Record<TaskMode, RiskLevel> = {
  ask: 'readonly',
  research: 'readonly',
  'scan-project': 'readonly',
  brainstorm: 'readonly',
  plan: 'plan',
  review: 'readonly',
  edit: 'mutate',
  debug: 'mutate',
  test: 'mutate',
  agent: 'mutate',
};

const RISK_DOT_CLASS: Record<RiskLevel, string> = {
  readonly: 'nx-mode-risk-dot--readonly',
  plan: 'nx-mode-risk-dot--plan',
  mutate: 'nx-mode-risk-dot--mutate',
};

export function ModeChipSelector({ mode, provider, matrix, disabled, onModeChange }: Props) {
  const t = useT();
  const isDirect = DIRECT_PROVIDERS.includes(provider);

  // Build risk tooltip text per mode
  const modeT = t.mode as Record<string, { label: string; desc: string } | string>;
  const riskReadOnly = typeof modeT.riskReadOnly === 'string' ? modeT.riskReadOnly : '';
  const riskPlan = typeof modeT.riskPlan === 'string' ? modeT.riskPlan : '';
  const riskMutate = typeof modeT.riskMutate === 'string' ? modeT.riskMutate : '';

  const getRiskText = (m: TaskMode): string => {
    const risk = MODE_RISK[m];
    if (risk === 'plan') return riskPlan;
    if (risk === 'mutate') return riskMutate;
    return riskReadOnly;
  };

  const currentModeFit = isDirect
    ? matrix.find(cap => cap.agentId === (provider as DirectProviderId) && cap.mode === mode)?.fit
    : undefined;

  return (
    <>
      <div className="nx-mode-selector-row">
        {ALL_MODES.map(m => {
          const fit = isDirect
            ? matrix.find(cap => cap.agentId === (provider as DirectProviderId) && cap.mode === m)?.fit
            : undefined;
          const isBest = fit === 'best';
          const isLimited = fit === 'limited';
          const isUnsupported = fit === 'unsupported';
          const label = (t.mode as Record<string, { label: string; desc: string }>)[m]?.label ?? m;
          const desc = (t.mode as Record<string, { label: string; desc: string }>)[m]?.desc ?? '';
          const fitText = fit
            ? `${t.agentCapability[fit === 'limited' ? 'limitedFit' : fit] ?? fit}`
            : '';
          const riskText = getRiskText(m);
          const tooltip = [label, desc, fitText, riskText].filter(Boolean).join('\n');
          const risk = MODE_RISK[m];

          return (
            <button
              key={m}
              type="button"
              className="nx-mode-chip"
              data-active={mode === m ? '' : undefined}
              disabled={disabled || isUnsupported}
              title={tooltip}
              onClick={() => !isUnsupported && onModeChange(m)}
            >
              <span className={`nx-mode-risk-dot ${RISK_DOT_CLASS[risk]}`} aria-hidden="true" />
              {isLimited && <span className="nx-mode-chip-limited" aria-hidden="true">⚠</span>}
              {label}
              {isBest && <span className="nx-mode-chip-fit" aria-hidden="true">★</span>}
            </button>
          );
        })}
      </div>
      {currentModeFit === 'limited' && (
        <div className="nx-limited-mode-banner" role="status">
          <span className="nx-limited-mode-banner-icon" aria-hidden="true">⚠</span>
          {t.composer.modeLimited}
        </div>
      )}
    </>
  );
}
