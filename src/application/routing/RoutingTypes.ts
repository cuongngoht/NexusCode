import type { AgentId, TaskMode } from '../../core/agent/AgentTask';

export type ProviderFailureReason =
  | 'missing_cli'
  | 'auth_error'
  | 'rate_limit'
  | 'timeout'
  | 'non_zero_exit'
  | 'empty_output'
  | 'user_cancelled'
  | 'permission_denied'
  | 'unknown';

export interface ProviderRouteStep {
  providerId: AgentId;
  model?: string;
}

export interface ProviderRoutePlan {
  raw: string;
  steps: ProviderRouteStep[];
}

export interface FallbackPolicyConfig {
  enabled: boolean;
  maxAttempts: number;
  retrySameProvider: boolean;
  fallbackOn: ProviderFailureReason[];
  doNotFallbackOn: ProviderFailureReason[];
}

// Re-export for convenience
export type { AgentId, TaskMode };
