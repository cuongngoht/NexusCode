import type { NexusPanelId } from '../../state/uiState';

interface Props {
  id: NexusPanelId;
  children: React.ReactNode;
}

export function NexusMainPanel({ id, children }: Props) {
  return (
    <div
      id={`nx-panel-${id}`}
      role="tabpanel"
      aria-labelledby={`nx-tab-${id}`}
      className="nx-main-panel"
    >
      {children}
    </div>
  );
}
