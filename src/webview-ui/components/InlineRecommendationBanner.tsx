import { useState, useEffect } from 'react';
import { interp, useT } from '../i18n';
import type { AgentRecommendation, DirectProviderId, ProviderId, TaskMode } from '../messages';

interface Props {
  mode: TaskMode;
  provider: ProviderId;
  recommendations: AgentRecommendation[];
  onUseRecommended: (id: ProviderId) => void;
}

const PROVIDER_LABELS: Record<DirectProviderId, string> = {
  claude: 'Claude',
  codex: 'Codex',
  antigravity: 'Antigravity',
  copilot: 'Copilot',
  aider: 'Aider',
  custom: 'Custom',
  grok: 'Grok',
};

export function InlineRecommendationBanner({ mode, provider, recommendations, onUseRecommended }: Props) {
  const t = useT();
  const recommendation = recommendations.find(r => r.mode === mode);
  const recommended = recommendation?.recommended;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [mode, recommended]);

  if (!recommended || recommended === provider || dismissed) return null;

  const providerLabel = PROVIDER_LABELS[recommended] ?? recommended;
  const modeLabel = (t.agent.modeLabel as Record<string, string>)[mode] ?? mode;

  return (
    <div className="nx-inline-rec-banner">
      <span className="nx-inline-rec-banner-icon" aria-hidden="true">⚡</span>
      <span className="nx-inline-rec-banner-text">
        {interp(t.agentCapability.inlineRecommendation, { provider: providerLabel, mode: modeLabel })}
      </span>
      <button
        type="button"
        className="nx-inline-rec-banner-use"
        onClick={() => onUseRecommended(recommended as ProviderId)}
      >
        {t.agentCapability.useIt}
      </button>
      <button
        type="button"
        className="nx-inline-rec-banner-dismiss"
        onClick={() => setDismissed(true)}
        aria-label={t.agentCapability.dismiss}
      >
        ×
      </button>
    </div>
  );
}
