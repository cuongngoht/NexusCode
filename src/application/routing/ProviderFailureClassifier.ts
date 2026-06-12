import type { ProviderFailureReason } from './RoutingTypes';
import type { AgentResult } from '../../core/agent/AgentResult';

/**
 * Classifies a provider failure into a structured reason code.
 * Accepts either an Error thrown by RunAgentUseCase, or an AgentResult
 * returned with a non-zero exit code or empty output.
 */
export class ProviderFailureClassifier {
  /**
   * Classify the failure.
   * @param input - An Error, an AgentResult, or any unknown thrown value.
   */
  static classify(input: unknown): ProviderFailureReason {
    // Handle AgentResult objects (non-zero exit or empty output)
    if (ProviderFailureClassifier.isAgentResult(input)) {
      if (input.exitCode !== 0 && input.stdout.trim() === '') {
        return 'empty_output';
      }
      if (input.exitCode !== 0) {
        return 'non_zero_exit';
      }
    }

    const msg = String(input).toLowerCase();

    if (msg.includes('rate limit') || msg.includes('429') || msg.includes('quota')) {
      return 'rate_limit';
    }
    if (
      msg.includes('auth') ||
      msg.includes('login') ||
      msg.includes('api key') ||
      msg.includes('unauthorized') ||
      msg.includes('401') ||
      msg.includes('403')
    ) {
      return 'auth_error';
    }
    if (msg.includes('timeout') || msg.includes('etimedout') || msg.includes('timed out')) {
      return 'timeout';
    }
    if (
      msg.includes('permission denied') ||
      msg.includes('eacces') ||
      msg.includes('eperm')
    ) {
      return 'permission_denied';
    }
    if (
      msg.includes('cancelled') ||
      msg.includes('canceled') ||
      msg.includes('sigterm')
    ) {
      return 'user_cancelled';
    }
    if (
      msg.includes('not found') ||
      msg.includes('enoent') ||
      msg.includes('no such file') ||
      msg.includes('not available')
    ) {
      return 'missing_cli';
    }

    return 'unknown';
  }

  private static isAgentResult(input: unknown): input is AgentResult {
    return (
      typeof input === 'object' &&
      input !== null &&
      'exitCode' in input &&
      'stdout' in input &&
      'stderr' in input
    );
  }
}
