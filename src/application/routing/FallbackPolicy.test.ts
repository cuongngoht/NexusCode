import { describe, it, expect } from 'vitest';
import { FallbackPolicy, DEFAULT_FALLBACK_POLICY_CONFIG } from './FallbackPolicy';
import type { FallbackPolicyConfig, ProviderFailureReason } from './RoutingTypes';

describe('FallbackPolicy', () => {
  describe('canFallback', () => {
    it('returns false when policy is disabled', () => {
      const policy = new FallbackPolicy({ ...DEFAULT_FALLBACK_POLICY_CONFIG, enabled: false });
      expect(policy.canFallback('rate_limit', 1)).toBe(false);
    });

    it('returns false when attemptCount >= maxAttempts', () => {
      const policy = new FallbackPolicy({ ...DEFAULT_FALLBACK_POLICY_CONFIG, maxAttempts: 2 });
      expect(policy.canFallback('rate_limit', 2)).toBe(false);
    });

    it('returns false when reason is in doNotFallbackOn', () => {
      const policy = new FallbackPolicy(DEFAULT_FALLBACK_POLICY_CONFIG);
      expect(policy.canFallback('user_cancelled', 1)).toBe(false);
      expect(policy.canFallback('permission_denied', 1)).toBe(false);
    });

    it('returns true for allowable failures within attempt limit', () => {
      const policy = new FallbackPolicy(DEFAULT_FALLBACK_POLICY_CONFIG);
      const fallbackableReasons: ProviderFailureReason[] = [
        'missing_cli', 'auth_error', 'rate_limit', 'timeout', 'non_zero_exit', 'empty_output',
      ];
      for (const reason of fallbackableReasons) {
        expect(policy.canFallback(reason, 1)).toBe(true);
      }
    });

    it('returns false for unknown reason not in fallbackOn', () => {
      const config: FallbackPolicyConfig = {
        ...DEFAULT_FALLBACK_POLICY_CONFIG,
        fallbackOn: ['rate_limit'],
      };
      const policy = new FallbackPolicy(config);
      expect(policy.canFallback('unknown', 1)).toBe(false);
    });

    it('allows fallback at attempt 1 with maxAttempts 2', () => {
      const policy = new FallbackPolicy({ ...DEFAULT_FALLBACK_POLICY_CONFIG, maxAttempts: 2 });
      expect(policy.canFallback('rate_limit', 1)).toBe(true);
    });

    it('denies fallback at attempt 2 with maxAttempts 2', () => {
      const policy = new FallbackPolicy({ ...DEFAULT_FALLBACK_POLICY_CONFIG, maxAttempts: 2 });
      expect(policy.canFallback('rate_limit', 2)).toBe(false);
    });

    it('exposes maxAttempts via getter', () => {
      const policy = new FallbackPolicy({ ...DEFAULT_FALLBACK_POLICY_CONFIG, maxAttempts: 5 });
      expect(policy.maxAttempts).toBe(5);
    });
  });
});
