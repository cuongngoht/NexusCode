import { useEffect, useRef, useState } from 'react';
import { IconCheck } from './NexusIcons';
import { useT } from './i18n';

export interface DropdownOption {
  value: string;
  label: string;
  desc?: string;
  badge?: string;
  icon?: React.ComponentType<{ size?: number }>;
}

interface Props {
  value: string;
  options: DropdownOption[];
  placeholder?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  direction?: 'up' | 'down';
  searchable?: boolean;
}

export function NexusDropdown({ value, options, placeholder, onChange, disabled, style, direction = 'down', searchable }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) { setQuery(''); return; }
    if (searchable) setTimeout(() => searchRef.current?.focus(), 0);
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, searchable]);

  const selected = options.find(o => o.value === value);
  const filtered = searchable && query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <div className="fl-dd" ref={ref} style={style}>
      <button
        type="button"
        className="fl-dd-trigger"
        data-open={open ? '1' : undefined}
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
      >
        <span className="fl-dd-value">
          {selected?.icon && <selected.icon size={13} />}
          <span className={`dd-label${selected ? '' : ' fl-dd-ph'}`}>
            {selected ? selected.label : (placeholder ?? t.dropdown.select)}
          </span>
          {selected?.badge && <span className="fl-dd-badge">{selected.badge}</span>}
        </span>
      </button>

      {open && (
        <div className={`fl-dd-menu fl-scroll${direction === 'up' ? ' fl-dd-menu--up' : ''}`}>
          {searchable && (
            <div className="fl-dd-search">
              <input
                ref={searchRef}
                type="text"
                className="fl-dd-search-input"
                placeholder={t.dropdown.search}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.stopPropagation()}
              />
            </div>
          )}
          {filtered.map(opt => (
            <button
              key={opt.value}
              type="button"
              className="fl-dd-opt"
              data-sel={opt.value === value ? '1' : undefined}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              <span className="fl-dd-opt-check-slot">
                {opt.value === value && <IconCheck size={13} className="fl-dd-opt-check" />}
              </span>
              <span className="fl-dd-opt-main">
                <span className="fl-dd-opt-label">{opt.label}</span>
                {opt.desc && <span className="fl-dd-opt-desc">{opt.desc}</span>}
              </span>
              {opt.badge && opt.value !== value && <span className="fl-dd-badge">{opt.badge}</span>}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="fl-dd-empty">{t.dropdown.noResults}</div>
          )}
        </div>
      )}
    </div>
  );
}
