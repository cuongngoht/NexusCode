export type NexusPanelId =
  | 'chat'
  | 'plan'
  | 'debug'
  | 'research'
  | 'artifacts'
  | 'analytics'
  | 'diff'
  | 'activity';

export interface UiState {
  activePanel: NexusPanelId;
  secondaryPanel?: NexusPanelId;
  isSecondaryPanelOpen: boolean;
  selectedArtifactId?: string;
  selectedDiffPath?: string;
}

export type UiAction =
  | { type: 'openPanel'; panel: NexusPanelId }
  | { type: 'closePanel' }
  | { type: 'toggleSecondaryPanel'; panel?: NexusPanelId }
  | { type: 'selectArtifact'; id: string }
  | { type: 'selectDiffFile'; path: string };

export function uiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case 'openPanel':
      return { ...state, activePanel: action.panel };
    case 'closePanel':
      return { ...state, isSecondaryPanelOpen: false };
    case 'toggleSecondaryPanel':
      return {
        ...state,
        isSecondaryPanelOpen: !state.isSecondaryPanelOpen,
        secondaryPanel: action.panel ?? state.secondaryPanel,
      };
    case 'selectArtifact':
      return { ...state, selectedArtifactId: action.id };
    case 'selectDiffFile':
      return { ...state, selectedDiffPath: action.path };
    default:
      return state;
  }
}

export function createInitialUiState(): UiState {
  return {
    activePanel: 'chat',
    secondaryPanel: undefined,
    isSecondaryPanelOpen: false,
    selectedArtifactId: undefined,
    selectedDiffPath: undefined,
  };
}
