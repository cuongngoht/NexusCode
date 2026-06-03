import { useEffect, useRef, useState } from 'react';
import { NexusDropdown, type DropdownOption } from '../NexusDropdown';
import {
  IconAdd, IconHistory, IconMore, IconSettings, IconInfo,
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
      if (!detectionDone) return false;
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

interface MoreMenuProps {
  onSettings: () => void;
  onAbout: () => void;
}

function MoreMenu({ onSettings, onAbout }: MoreMenuProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleItem = (cb: () => void) => {
    setOpen(false);
    cb();
  };

  return (
    <div className="fl-dd" ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="fl-iconbtn"
        title={t.toolbar.more}
        data-open={open ? '1' : undefined}
        onClick={() => setOpen(o => !o)}
      >
        <IconMore size={16} />
      </button>

      {open && (
        <div className="fl-dd-menu" style={{ right: 0, left: 'auto', minWidth: 140 }}>
          <button
            type="button"
            className="fl-dd-opt"
            onClick={() => handleItem(onSettings)}
          >
            <IconSettings size={15} />
            <span className="fl-dd-opt-main">
              <span className="fl-dd-opt-label">{t.toolbar.settings}</span>
            </span>
          </button>
          <button
            type="button"
            className="fl-dd-opt"
            onClick={() => handleItem(onAbout)}
          >
            <IconInfo size={15} />
            <span className="fl-dd-opt-main">
              <span className="fl-dd-opt-label">{t.toolbar.about}</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
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
  onOpenSettings: () => void;
  onAbout: () => void;
}

export function AppToolbar({
  provider, selectedModel, mode, availableProviders, providerDetection, isRunning,
  showHistory, conversationCount, locale,
  onProviderChange, onModelChange, onModeChange, onNewConversation, onToggleHistory, onLocaleChange,
  onOpenSettings, onAbout,
}: Props) {
  const t = useT();
  const providerOptions = getProviderOptions(availableProviders, providerDetection, t);

  const currentInfo = providerDetection.find(d => d.id === provider);
  const showModelSelector = !!currentInfo?.supportsModelSelection && currentInfo.models.length > 0;
  const modelOptions: DropdownOption[] = showModelSelector
    ? [
        { value: '', label: t.model.auto, icon: IconSparkle },
        ...currentInfo!.models.map(m => ({ value: m.id, label: m.label, icon: IconBrain })),
      ]
    : [];

  const modeOptions: DropdownOption[] = [
    { value: 'ask', label: t.mode.ask.label, desc: t.mode.ask.desc, icon: IconSparkle },
    { value: 'edit', label: t.mode.edit.label, desc: t.mode.edit.desc, icon: IconTool },
    { value: 'research', label: t.mode.research.label, desc: t.mode.research.desc, icon: IconGlobe },
    { value: 'review', label: t.mode.review.label, desc: t.mode.review.desc, icon: IconAgent },
    { value: 'debug', label: t.mode.debug.label, desc: t.mode.debug.desc, icon: IconSearch },
    { value: 'plan', label: t.mode.plan.label, desc: t.mode.plan.desc, icon: IconBrain },
    { value: 'test', label: t.mode.test.label, desc: t.mode.test.desc, icon: IconTool },
    { value: 'scan-project', label: t.mode['scan-project'].label, desc: t.mode['scan-project'].desc, icon: IconSearch },
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
          <MoreMenu onSettings={onOpenSettings} onAbout={onAbout} />
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
        {showModelSelector && (
          <NexusDropdown
            value={selectedModel ?? ''}
            options={modelOptions}
            onChange={v => onModelChange(v || undefined)}
            disabled={isRunning}
            style={{ gridColumn: '1 / -1' }}
          />
        )}
      </div>
    </>
  );
}
