import type { NexusPanelId } from '../../state/uiState';

interface Tab {
  id: NexusPanelId;
  label: string;
  icon?: string;
}

interface Props {
  tabs: Tab[];
  active: NexusPanelId;
  onSelect: (id: NexusPanelId) => void;
}

export function PanelTabs({ tabs, active, onSelect }: Props) {
  return (
    <div className="nx-panel-tabs" role="tablist">
      {tabs.map(tab => (
        <button
          key={tab.id}
          id={`nx-tab-${tab.id}`}
          type="button"
          role="tab"
          aria-selected={active === tab.id ? 'true' : 'false'}
          aria-controls={`nx-panel-${String(tab.id)}`}
          className={`nx-panel-tab ${active === tab.id ? 'nx-panel-tab--active' : ''}`}
          onClick={() => onSelect(tab.id)}
        >
          {tab.icon && <span className="nx-panel-tab-icon" aria-hidden="true">{tab.icon}</span>}
          <span className="nx-panel-tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
