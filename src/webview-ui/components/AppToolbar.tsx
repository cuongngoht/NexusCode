import { useState } from 'react';
import { NexusDropdown, type DropdownOption } from '../NexusDropdown';
import {
  IconAdd, IconHistory, IconMore,
  IconSparkle, IconBrain, IconTool, IconGlobe, IconAgent, IconSearch,
} from '../NexusIcons';
import type { ProviderId, TaskMode, ProviderInfo } from '../messages';

const TABS = ['CHAT', 'NEXUS', 'CLAUDE CODE'] as const;

const MODE_OPTIONS: DropdownOption[] = [
  { value: 'ask',          label: 'Ask',             desc: 'Chat only · no tools',    icon: IconSparkle },
  { value: 'edit',         label: 'Build Agent',     desc: 'Edits code, runs tools',  icon: IconTool },
  { value: 'research',     label: 'Research Agent',  desc: 'Web search + synthesis',  icon: IconGlobe },
  { value: 'review',       label: 'Code Reviewer',   desc: 'Reads & critiques',       icon: IconAgent },
  { value: 'debug',        label: 'Debug Agent',     desc: 'Find & fix bugs',         icon: IconSearch },
  { value: 'plan',         label: 'Planner',         desc: 'Plan before executing',   icon: IconBrain },
  { value: 'test',         label: 'Test Agent',      desc: 'Write & run tests',       icon: IconTool },
  { value: 'scan-project', label: 'Scan Project',    desc: 'Analyse the workspace',   icon: IconSearch },
];

function getProviderOptions(
  availableProviders: string[],
  detection: ProviderInfo[],
): DropdownOption[] {
  const all: ProviderId[] = ['auto', 'claude', 'codex', 'gemini', 'copilot', 'aider', 'custom'];
  const availableSet = new Set(availableProviders);
  const detectionDone = detection.length > 0;

  return all
    .filter(id => {
      if (id === 'auto' || id === 'custom') return true;
      if (!detectionDone) return true;
      return availableSet.has(id);
    })
    .map(id => {
      if (id === 'auto') return { value: 'auto', label: 'Auto-detect', icon: IconSparkle, badge: 'Default' };
      if (id === 'custom') return { value: 'custom', label: 'Custom CLI', icon: IconTool };
      const info = detection.find(d => d.id === id);
      const label = info ? (info.version ? `${info.cliLabel} ${info.version}` : info.cliLabel) : id;
      return { value: id, label, icon: IconSparkle };
    });
}

interface Props {
  provider: ProviderId;
  selectedModel?: string;
  mode: TaskMode;
  availableProviders: string[];
  providerDetection: ProviderInfo[];
  isRunning: boolean;
  showHistory: boolean;
  conversationCount: number;
  onProviderChange: (v: ProviderId) => void;
  onModelChange: (v?: string) => void;
  onModeChange: (v: TaskMode) => void;
  onNewConversation: () => void;
  onToggleHistory: () => void;
}

export function AppToolbar({
  provider, mode, availableProviders, providerDetection, isRunning,
  showHistory, conversationCount,
  onProviderChange, onModelChange, onModeChange, onNewConversation, onToggleHistory,
}: Props) {
  const [activeTab, setActiveTab] = useState<string>('NEXUS');

  const providerOptions = getProviderOptions(availableProviders, providerDetection);

  return (
    <>
      {/* ── Tab strip ── */}
      <header className="fl-topbar">
        <nav className="fl-tabs" aria-label="Panel tabs">
          {TABS.map(tab => (
            <button
              key={tab}
              type="button"
              className="fl-tab"
              data-active={tab === activeTab ? '1' : undefined}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              <span className="fl-tab-underline" />
            </button>
          ))}
        </nav>
        <div className="fl-winctl">
          <button
            type="button"
            className="fl-iconbtn"
            title="New conversation"
            onClick={onNewConversation}
            disabled={isRunning}
          >
            <IconAdd size={16} />
          </button>
          <button type="button" className="fl-iconbtn" title="More">
            <IconMore size={16} />
          </button>
        </div>
      </header>

      {/* ── Subheader ── */}
      <div className="fl-subhead">
        <span className="fl-brand">NEXUS</span>
        <div className="fl-subhead-actions">
          <button
            type="button"
            className="fl-iconbtn"
            title="New conversation"
            onClick={onNewConversation}
            disabled={isRunning}
          >
            <IconAdd size={16} />
          </button>
          <button
            type="button"
            className="fl-iconbtn"
            title={`History (${conversationCount})`}
            data-active={showHistory ? '1' : undefined}
            onClick={onToggleHistory}
          >
            <IconHistory size={16} />
          </button>
        </div>
      </div>

      {/* ── Provider + Mode dropdowns ── */}
      <div className="fl-selectors">
        <NexusDropdown
          value={provider}
          options={providerOptions}
          onChange={v => {
            onProviderChange(v as ProviderId);
            onModelChange(undefined);
          }}
          disabled={isRunning}
        />
        <NexusDropdown
          value={mode}
          options={MODE_OPTIONS}
          onChange={v => onModeChange(v as TaskMode)}
          disabled={isRunning}
        />
      </div>
    </>
  );
}
