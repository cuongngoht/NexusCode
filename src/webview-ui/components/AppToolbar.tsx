import { NexusDropdown, type DropdownOption } from '../NexusDropdown';
import {
  IconAdd, IconHistory, IconMore,
  IconSparkle, IconBrain, IconTool, IconGlobe, IconAgent, IconSearch,
} from '../NexusIcons';
import type { ProviderId, TaskMode, ProviderInfo } from '../messages';
import { useT, interp, type Locale } from '../i18n';

function getProviderOptions(
  availableProviders: string[],
  detection: ProviderInfo[],
  t: ReturnType<typeof useT>,
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
      if (id === 'auto') return { value: 'auto', label: t.provider.autoDetect, icon: IconSparkle, badge: t.provider.autoDetectBadge };
      if (id === 'custom') return { value: 'custom', label: t.provider.customCli, icon: IconTool };
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
  locale: Locale;
  onProviderChange: (v: ProviderId) => void;
  onModelChange: (v?: string) => void;
  onModeChange: (v: TaskMode) => void;
  onNewConversation: () => void;
  onToggleHistory: () => void;
  onLocaleChange: (l: Locale) => void;
}

export function AppToolbar({
  provider, mode, availableProviders, providerDetection, isRunning,
  showHistory, conversationCount, locale,
  onProviderChange, onModelChange, onModeChange, onNewConversation, onToggleHistory, onLocaleChange,
}: Props) {
  const t = useT();
  const providerOptions = getProviderOptions(availableProviders, providerDetection, t);

  const modeOptions: DropdownOption[] = [
    { value: 'ask',          label: t.mode.ask.label,                   desc: t.mode.ask.desc,                   icon: IconSparkle },
    { value: 'edit',         label: t.mode.edit.label,                  desc: t.mode.edit.desc,                  icon: IconTool },
    { value: 'research',     label: t.mode.research.label,              desc: t.mode.research.desc,              icon: IconGlobe },
    { value: 'review',       label: t.mode.review.label,                desc: t.mode.review.desc,                icon: IconAgent },
    { value: 'debug',        label: t.mode.debug.label,                 desc: t.mode.debug.desc,                 icon: IconSearch },
    { value: 'plan',         label: t.mode.plan.label,                  desc: t.mode.plan.desc,                  icon: IconBrain },
    { value: 'test',         label: t.mode.test.label,                  desc: t.mode.test.desc,                  icon: IconTool },
    { value: 'scan-project', label: t.mode['scan-project'].label,       desc: t.mode['scan-project'].desc,       icon: IconSearch },
  ];

  return (
    <>
      <div className="fl-subhead">
        <span className="fl-brand">{t.toolbar.brand}</span>
        <div className="fl-subhead-actions">
          <button
            type="button"
            className="fl-iconbtn fl-locale-toggle"
            title={t.toolbar.switchLang}
            onClick={() => onLocaleChange(locale === 'vi' ? 'en' : 'vi')}
          >
            {locale === 'vi' ? 'EN' : 'VI'}
          </button>
          <button
            type="button"
            className="fl-iconbtn"
            title={t.toolbar.newConversation}
            onClick={onNewConversation}
            disabled={isRunning}
          >
            <IconAdd size={16} />
          </button>
          <button
            type="button"
            className="fl-iconbtn"
            title={interp(t.toolbar.history, { count: conversationCount })}
            data-active={showHistory ? '1' : undefined}
            onClick={onToggleHistory}
          >
            <IconHistory size={16} />
          </button>
          <button type="button" className="fl-iconbtn" title={t.toolbar.more}>
            <IconMore size={16} />
          </button>
        </div>
      </div>

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
          options={modeOptions}
          onChange={v => onModeChange(v as TaskMode)}
          disabled={isRunning}
        />
      </div>
    </>
  );
}
