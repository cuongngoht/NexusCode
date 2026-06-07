import { useState } from 'react';
import { NexusDropdown, type DropdownOption } from '../NexusDropdown';
import { IconSparkle, IconTool } from '../NexusIcons';
import { useT } from '../i18n';
import type { ProviderInfo, ProviderId, TaskMode } from '../messages';

interface PlanReadyCardProps {
  mode: TaskMode;
  model?: string;
  planPath?: string;
  providerDetection: ProviderInfo[];
  availableProviders: string[];
  onApply(provider: ProviderId, model?: string): void;
  onEdit(): void;
  onOpenSavedPlans(): void;
}

export function PlanReadyCard({
  mode, model, planPath,
  providerDetection, availableProviders,
  onApply, onEdit, onOpenSavedPlans,
}: PlanReadyCardProps) {
  const t = useT();
  const n = t.nexus as Record<string, string>;

  const [selectedProvider, setSelectedProvider] = useState<ProviderId>('nexus');
  const [selectedModel, setSelectedModel] = useState<string | undefined>(model);

  const availableSet = new Set(availableProviders);
  const allProviders: ProviderId[] = ['nexus', 'claude', 'codex', 'gemini', 'copilot', 'aider', 'custom'];
  const providerOptions: DropdownOption[] = allProviders
    .filter(id => id === 'nexus' || id === 'custom' || availableSet.has(id))
    .map(id => {
      if (id === 'nexus') return { value: 'nexus', label: 'Nexus', icon: IconSparkle, badge: t.nexus.badge };
      if (id === 'custom') return { value: 'custom', label: t.provider.customCli, icon: IconTool };
      const info = providerDetection.find(d => d.id === id);
      const label = info ? (info.version ? `${info.cliLabel} ${info.version}` : info.cliLabel) : id;
      return { value: id, label, icon: IconSparkle };
    });

  const selectedProviderInfo = providerDetection.find(d => d.id === selectedProvider);
  const modelOptions: DropdownOption[] = selectedProviderInfo?.models?.map(m => ({
    value: m.id,
    label: m.label,
  })) ?? [];
  const showModelPicker = modelOptions.length > 0;

  const handleProviderChange = (v: string) => {
    setSelectedProvider(v as ProviderId);
    const info = providerDetection.find(d => d.id === v);
    setSelectedModel(info?.defaultModel);
  };

  return (
    <div className="nx-plan-card">
      <div className="nx-plan-card-header">
        <span className="nx-plan-card-title">{n.planReady}</span>
        <span className="nx-plan-card-badge">{n.planSavedBadge}</span>
      </div>

      <div className="nx-plan-card-meta">
        <div className="nx-plan-card-meta-row">
          <span className="nx-plan-card-meta-label">{n.mode}:</span>
          <span>{mode}</span>
        </div>
        {planPath && (
          <div className="nx-plan-card-meta-row">
            <span className="nx-plan-card-meta-label">{n.planPath}:</span>
            <span className="nx-plan-card-path" title={planPath}>{planPath}</span>
          </div>
        )}
      </div>

      <div className="nx-plan-card-selectors">
        <div className="nx-plan-card-selector-row">
          <span className="nx-plan-card-selector-label">{n.provider}</span>
          <NexusDropdown
            value={selectedProvider}
            options={providerOptions}
            onChange={handleProviderChange}
            direction="up"
          />
        </div>
        {showModelPicker && (
          <div className="nx-plan-card-selector-row">
            <span className="nx-plan-card-selector-label">{n.model}</span>
            <NexusDropdown
              value={selectedModel ?? modelOptions[0]?.value ?? ''}
              options={modelOptions}
              onChange={v => setSelectedModel(v)}
              direction="up"
            />
          </div>
        )}
      </div>

      <div className="nx-plan-card-actions">
        <button
          type="button"
          className="fl-btn-primary"
          onClick={() => onApply(selectedProvider, selectedModel)}
        >
          {n.applyThisPlan}
        </button>
        <button type="button" className="fl-btn-secondary" onClick={onEdit}>
          {n.editPlanBeforeApply}
        </button>
        <button type="button" className="fl-btn-secondary" onClick={onOpenSavedPlans}>
          {n.openSavedPlans}
        </button>
      </div>
    </div>
  );
}
