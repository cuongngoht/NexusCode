import { useEffect, useRef, useState } from 'react';
import { IconChevron, IconCheck } from './NexusIcons';

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
}

export function NexusDropdown({ value, options, placeholder, onChange, disabled }: Props) {
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

  const selected = options.find(o => o.value === value);

  return (
    <div className="fl-dd" ref={ref}>
      <button
        type="button"
        className="fl-dd-trigger"
        data-open={open ? '1' : undefined}
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
      >
        <span className="fl-dd-value">
          {selected?.icon && <selected.icon size={14} />}
          <span className={`dd-label${selected ? '' : ' fl-dd-ph'}`}>
            {selected ? selected.label : (placeholder ?? 'Select…')}
          </span>
          {selected?.badge && <span className="fl-dd-badge">{selected.badge}</span>}
        </span>
        <IconChevron size={14} className="fl-dd-chevron" />
      </button>

      {open && (
        <div className="fl-dd-menu fl-scroll">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              className="fl-dd-opt"
              data-sel={opt.value === value ? '1' : undefined}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              {opt.icon ? <opt.icon size={15} /> : <span style={{ width: 15 }} />}
              <span className="fl-dd-opt-main">
                <span className="fl-dd-opt-label">{opt.label}</span>
                {opt.desc && <span className="fl-dd-opt-desc">{opt.desc}</span>}
              </span>
              {opt.value === value
                ? <IconCheck size={14} className="fl-dd-opt-check" />
                : opt.badge ? <span className="fl-dd-badge">{opt.badge}</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
