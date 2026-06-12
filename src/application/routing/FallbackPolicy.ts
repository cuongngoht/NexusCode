import type { FallbackPolicyConfig, ProviderFailureReason } from './RoutingTypes';

export class FallbackPolicy {
  constructor(private readonly config: FallbackPolicyConfig) {}

  /**
   * Returns true if a fallback attempt is allowed.
   *
   * @param reason   - Why the current provider failed.
   * @param attemptCount - Number of attempts made so far (1-based: 1 after first failure).
   */
  canFallback(reason: ProviderFailureReason, attemptCount: number): boolean {
    if (!this.config.enabled) return false;
    if (attemptCount >= this.config.maxAttempts) return false;
    if (this.config.doNotFallbackOn.includes(reason)) return false;
    return this.config.fallbackOn.includes(reason);
  }

  get maxAttempts(): number {
    return this.config.maxAttempts;
  }
}

export const DEFAULT_FALLBACK_POLICY_CONFIG: FallbackPolicyConfig = {
  enabled: true,
  maxAttempts: 2,
  retrySameProvider: false,
  fallbackOn: [
    'missing_cli',
    'auth_error',
    'rate_limit',
    'timeout',
    'non_zero_exit',
    'empty_output',
  ],
  doNotFallbackOn: ['user_cancelled', 'permission_denied'],
};
