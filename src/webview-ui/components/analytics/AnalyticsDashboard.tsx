import { useCallback, useEffect, useState } from 'react';
import { useT } from '../../i18n';
import { getVsCodeApi } from '../../vscodeApi';
import type { AnalyticsDashboardSummary, AnalyticsRunRecord, AppAction } from '../../messages';
import { AnalyticsSummaryCards } from './AnalyticsSummaryCards';
import { AnalyticsFilters, filtersToQuery, type FilterState } from './AnalyticsFilters';
import { TokenUsageChart } from './TokenUsageChart';
import { CostChart } from './CostChart';
import { ProviderReliabilityChart } from './ProviderReliabilityChart';
import { ProductivityMetricsPanel } from './ProductivityMetricsPanel';
import { QualityMetricsPanel } from './QualityMetricsPanel';
import { WorkflowCostTable } from './WorkflowCostTable';
import { ConversationUsageTable } from './ConversationUsageTable';

interface Props {
  summary?: AnalyticsDashboardSummary;
  runs?: AnalyticsRunRecord[];
  loading: boolean;
  error?: string;
  dispatch: React.Dispatch<AppAction>;
}

const DEFAULT_FILTERS: FilterState = { preset: 'all' };

export function AnalyticsDashboard({ summary, loading, error, dispatch }: Props) {
  const t = useT();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [clearConfirm, setClearConfirm] = useState(false);

  const fetchSummary = useCallback((f: FilterState) => {
    dispatch({ type: 'analyticsLoading' });
    getVsCodeApi().postMessage({ type: 'getAnalyticsSummary', query: filtersToQuery(f) });
  }, [dispatch]);

  useEffect(() => {
    fetchSummary(filters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFiltersChange = useCallback((f: FilterState) => {
    setFilters(f);
    fetchSummary(f);
  }, [fetchSummary]);

  const handleExport = useCallback((format: 'json' | 'csv' | 'markdown') => {
    getVsCodeApi().postMessage({
      type: 'exportAnalytics',
      format,
      query: filtersToQuery(filters),
    });
  }, [filters]);

  const handleClear = useCallback(() => {
    if (!clearConfirm) {
      setClearConfirm(true);
      return;
    }
    setClearConfirm(false);
    getVsCodeApi().postMessage({ type: 'clearAnalytics' });
  }, [clearConfirm]);

  const providers = summary?.byProvider.map(p => p.provider) ?? [];
  const modes = summary?.byMode.map(m => m.mode) ?? [];

  return (
    <div className="nx-analytics-dashboard">
      <div className="nx-analytics-header">
        <h2 className="nx-analytics-title">{t.dashboard.title}</h2>
        <div className="nx-analytics-actions">
          <div className="nx-analytics-export-group">
            <span className="nx-analytics-export-label">{t.dashboard.export}:</span>
            <button type="button" className="nx-analytics-btn nx-analytics-btn--small" onClick={() => handleExport('json')}>JSON</button>
            <button type="button" className="nx-analytics-btn nx-analytics-btn--small" onClick={() => handleExport('csv')}>CSV</button>
            <button type="button" className="nx-analytics-btn nx-analytics-btn--small" onClick={() => handleExport('markdown')}>MD</button>
          </div>
          {clearConfirm ? (
            <div className="nx-analytics-clear-confirm">
              <span>{t.dashboard.clearConfirm}</span>
              <button type="button" className="nx-analytics-btn nx-analytics-btn--danger nx-analytics-btn--small" onClick={handleClear}>
                {t.dashboard.confirmYes}
              </button>
              <button type="button" className="nx-analytics-btn nx-analytics-btn--small" onClick={() => setClearConfirm(false)}>
                {t.dashboard.confirmNo}
              </button>
            </div>
          ) : (
            <button type="button" className="nx-analytics-btn nx-analytics-btn--ghost nx-analytics-btn--small" onClick={handleClear}>
              {t.dashboard.clear}
            </button>
          )}
        </div>
      </div>

      <AnalyticsFilters
        filters={filters}
        providers={providers}
        modes={modes}
        onFiltersChange={handleFiltersChange}
      />

      {error && (
        <div className="nx-analytics-error" role="alert">
          {error}
          <button
            type="button"
            className="nx-analytics-btn nx-analytics-btn--small"
            onClick={() => {
              dispatch({ type: 'clearAnalyticsError' });
              fetchSummary(filters);
            }}
          >
            {t.dashboard.retry}
          </button>
        </div>
      )}

      {loading && (
        <div className="nx-analytics-loading" role="status">
          {t.dashboard.loading}
        </div>
      )}

      {!loading && !error && !summary && (
        <div className="nx-analytics-empty">{t.dashboard.noData}</div>
      )}

      {!loading && summary && (
        <>
          <AnalyticsSummaryCards summary={summary} />

          <div className="nx-analytics-grid">
            <TokenUsageChart
              byProvider={summary.byProvider}
              title={t.dashboard.tokensByProvider}
            />
            <CostChart
              byProvider={summary.byProvider}
              title={t.dashboard.costByProvider}
            />
          </div>

          <ProviderReliabilityChart byProvider={summary.byProvider} />

          <div className="nx-analytics-grid nx-analytics-grid--2col">
            <ProductivityMetricsPanel summary={summary} />
            <QualityMetricsPanel summary={summary} />
          </div>

          <WorkflowCostTable workflows={summary.mostExpensiveWorkflows} />
          <ConversationUsageTable conversations={summary.byConversation} />
        </>
      )}
    </div>
  );
}
