import { useEffect, useRef, useState } from 'react';
import {
  IconAdd, IconHistory, IconMore, IconSettings, IconInfo, IconReviewList,
} from '../NexusIcons';
import type { Locale } from '../i18n';
import { useT, interp } from '../i18n';

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
  isRunning: boolean;
  showHistory: boolean;
  conversationCount: number;
  locale: Locale;
  showReviewHistory: boolean;
  reviewHistoryCount: number;
  onNewConversation: () => void;
  onToggleHistory: () => void;
  onToggleReviewHistory: () => void;
  onLocaleChange: (l: Locale) => void;
  onOpenSettings: () => void;
  onAbout: () => void;
}

export function AppToolbar({
  isRunning, showHistory, conversationCount, locale,
  showReviewHistory, reviewHistoryCount,
  onNewConversation, onToggleHistory, onToggleReviewHistory, onLocaleChange,
  onOpenSettings, onAbout,
}: Props) {
  const t = useT();

  return (
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
          className={`fl-iconbtn nx-hist-btn${showHistory ? ' nx-hist-btn-on' : ''}`}
          title={interp(t.toolbar.history, { count: conversationCount })}
          onClick={onToggleHistory}
        >
          <IconHistory size={16} />
        </button>
        <button
          type="button"
          className={`fl-iconbtn nx-hist-btn${showReviewHistory ? ' nx-hist-btn-on' : ''}`}
          title={t.toolbar.reviewHistory}
          onClick={onToggleReviewHistory}
        >
          <IconReviewList size={16} />
        </button>
        <MoreMenu onSettings={onOpenSettings} onAbout={onAbout} />
      </div>
    </div>
  );
}

