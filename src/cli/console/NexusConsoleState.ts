export interface NexusConsoleState {
  workspaceRoot: string;
  providerRoute: string;
  mode: string;
  stage: string;
  model?: string;
  autoApprove: boolean;
}

export const DEFAULT_CONSOLE_STATE: Omit<NexusConsoleState, 'workspaceRoot'> = {
  providerRoute: 'antigravity+grok',
  mode: 'edit',
  stage: 'auto',
  autoApprove: false,
};
