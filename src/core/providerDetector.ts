/**
 * @deprecated
 *
 * Provider detection has been moved out of `core/` to `provider-hub/ProviderDetector`
 * to uphold Clean Architecture rules:
 *   - Domain / core must have zero Node I/O and zero dependencies on outer layers
 *     (provider-hub, debug, application, etc.).
 *
 * Source of truth:
 *   import { ProviderDetector } from '../provider-hub/ProviderDetector';
 *   import type { ProviderDetectionResult } from '../provider-hub/ProviderTypes';
 *
 * This file is kept as a re-export shim for backward compatibility during the
 * transition. Do not add new logic here.
 */

export { ProviderDetector } from '../provider-hub/ProviderDetector';
export type { ProviderDetectionResult, ProviderAuthStatus } from '../provider-hub/ProviderTypes';
