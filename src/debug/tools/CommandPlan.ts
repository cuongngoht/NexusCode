export interface CommandPlan {
  command: string;
  args: string[];
  purpose: string;
  isDestructive: boolean;
  requiresApproval: boolean;
}
