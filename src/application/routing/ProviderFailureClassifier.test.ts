import { describe, it, expect } from 'vitest';
import { ProviderFailureClassifier } from './ProviderFailureClassifier';
import { AgentResult } from '../../core/agent/AgentResult';

describe('ProviderFailureClassifier', () => {
  it('classifies rate_limit from "rate limit" in message', () => {
    expect(ProviderFailureClassifier.classify(new Error('rate limit exceeded'))).toBe('rate_limit');
  });

  it('classifies rate_limit from 429 status code in message', () => {
    expect(ProviderFailureClassifier.classify(new Error('HTTP 429'))).toBe('rate_limit');
  });

  it('classifies rate_limit from quota message', () => {
    expect(ProviderFailureClassifier.classify(new Error('quota exceeded'))).toBe('rate_limit');
  });

  it('classifies auth_error from unauthorized', () => {
    expect(ProviderFailureClassifier.classify(new Error('unauthorized'))).toBe('auth_error');
  });

  it('classifies auth_error from 401', () => {
    expect(ProviderFailureClassifier.classify(new Error('HTTP 401'))).toBe('auth_error');
  });

  it('classifies auth_error from api key', () => {
    expect(ProviderFailureClassifier.classify(new Error('Invalid api key'))).toBe('auth_error');
  });

  it('classifies timeout from timeout message', () => {
    expect(ProviderFailureClassifier.classify(new Error('timeout'))).toBe('timeout');
  });

  it('classifies timeout from ETIMEDOUT', () => {
    expect(ProviderFailureClassifier.classify(new Error('ETIMEDOUT'))).toBe('timeout');
  });

  it('classifies permission_denied from EACCES', () => {
    expect(ProviderFailureClassifier.classify(new Error('EACCES permission denied'))).toBe('permission_denied');
  });

  it('classifies user_cancelled from SIGTERM', () => {
    expect(ProviderFailureClassifier.classify(new Error('SIGTERM'))).toBe('user_cancelled');
  });

  it('classifies user_cancelled from cancelled', () => {
    expect(ProviderFailureClassifier.classify(new Error('Task was cancelled'))).toBe('user_cancelled');
  });

  it('classifies missing_cli from not found', () => {
    expect(ProviderFailureClassifier.classify(new Error('claude not found'))).toBe('missing_cli');
  });

  it('classifies missing_cli from ENOENT', () => {
    expect(ProviderFailureClassifier.classify(new Error('ENOENT: no such file or directory'))).toBe('missing_cli');
  });

  it('classifies empty_output from AgentResult with non-zero exit and empty stdout', () => {
    const result = new AgentResult(1, '', 'error text', 100);
    expect(ProviderFailureClassifier.classify(result)).toBe('empty_output');
  });

  it('classifies non_zero_exit from AgentResult with non-zero exit and non-empty stdout', () => {
    const result = new AgentResult(1, 'some output', '', 100);
    expect(ProviderFailureClassifier.classify(result)).toBe('non_zero_exit');
  });

  it('returns unknown for unrecognized errors', () => {
    expect(ProviderFailureClassifier.classify(new Error('something completely different'))).toBe('unknown');
  });

  it('handles string inputs gracefully', () => {
    expect(ProviderFailureClassifier.classify('rate limit exceeded')).toBe('rate_limit');
  });

  it('handles null gracefully', () => {
    expect(ProviderFailureClassifier.classify(null)).toBe('unknown');
  });
});
