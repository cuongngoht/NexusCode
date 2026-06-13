import type { UiState, UiAction } from '../../state/uiState';
import { NexusSecondaryPanel } from './NexusSecondaryPanel';

interface Props {
  uiState: UiState;
  onUiAction: (action: UiAction) => void;
  children: React.ReactNode;
  secondaryContent?: React.ReactNode;
  secondaryTitle?: string;
  statusContent?: React.ReactNode;
}

export function NexusShell({
  uiState,
  onUiAction,
  children,
  secondaryContent,
  secondaryTitle,
  statusContent,
}: Props) {
  return (
    <div className="nx-shell">
      <div className="nx-shell-body">
        <div className="nx-shell-main">
          {children}
        </div>
        {uiState.isSecondaryPanelOpen && secondaryContent && (
          <NexusSecondaryPanel
            isOpen={uiState.isSecondaryPanelOpen}
            title={secondaryTitle}
            onClose={() => onUiAction({ type: 'closePanel' })}
          >
            {secondaryContent}
          </NexusSecondaryPanel>
        )}
      </div>
      {statusContent && (
        <div className="nx-shell-status">{statusContent}</div>
      )}
    </div>
  );
}
