import { useT } from '../../i18n';
import type { AnalyticsQuery } from '../../messages';

export interface FilterState {
  preset: 'today' | 'last7days' | 'last30days' | 'thisMonth' | 'custom' | 'all';
  provider?: string;
  mode?: string;
  from?: number;
  to?: number;
}

interface Props {
  filters: FilterState;
  providers: string[];
  modes: string[];
  onFiltersChange: (filters: FilterState) => void;
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfMonth(ts: number): number {
  const d = new Date(ts);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function filtersToQuery(filters: FilterState): AnalyticsQuery {
  const now = Date.now();
  const query: AnalyticsQuery = {};

  switch (filters.preset) {
    case 'today':
      query.from = startOfDay(now);
      break;
    case 'last7days':
      query.from = now - 7 * 24 * 60 * 60 * 1000;
      break;
    case 'last30days':
      query.from = now - 30 * 24 * 60 * 60 * 1000;
      break;
    case 'thisMonth':
      query.from = startOfMonth(now);
      break;
    case 'custom':
      if (filters.from) query.from = filters.from;
      if (filters.to) query.to = filters.to;
      break;
    default:
      break;
  }

  if (filters.provider) query.provider = filters.provider;
  if (filters.mode) query.mode = filters.mode;

  return query;
}

export function AnalyticsFilters({ filters, providers, modes, onFiltersChange }: Props) {
  const t = useT();

  const presets: Array<{ key: FilterState['preset']; label: string }> = [
    { key: 'all', label: t.dashboard.filters.all },
    { key: 'today', label: t.dashboard.filters.today },
    { key: 'last7days', label: t.dashboard.filters.last7days },
    { key: 'last30days', label: t.dashboard.filters.last30days },
    { key: 'thisMonth', label: t.dashboard.filters.thisMonth },
  ];

  return (
    <div className="nx-analytics-filters">
      <div className="nx-analytics-filter-group">
        {presets.map(p => (
          <button
            key={p.key}
            type="button"
            className={`nx-analytics-filter-btn${filters.preset === p.key ? ' nx-analytics-filter-btn--active' : ''}`}
            onClick={() => onFiltersChange({ ...filters, preset: p.key })}
          >
            {p.label}
          </button>
        ))}
      </div>

      {providers.length > 1 && (
        <select
          className="nx-analytics-select"
          value={filters.provider ?? ''}
          onChange={e => onFiltersChange({ ...filters, provider: e.target.value || undefined })}
          aria-label={t.dashboard.filters.providerFilter}
        >
          <option value="">{t.dashboard.filters.allProviders}</option>
          {providers.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      )}

      {modes.length > 1 && (
        <select
          className="nx-analytics-select"
          value={filters.mode ?? ''}
          onChange={e => onFiltersChange({ ...filters, mode: e.target.value || undefined })}
          aria-label={t.dashboard.filters.modeFilter}
        >
          <option value="">{t.dashboard.filters.allModes}</option>
          {modes.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      )}
    </div>
  );
}
