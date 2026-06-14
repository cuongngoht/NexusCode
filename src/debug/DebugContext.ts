// Re-export the canonical Debug* types from the core domain layer.
// This keeps src/debug/ as the feature's public surface while ensuring
// src/core/ (domain) has zero dependencies on outer layers.
export type {
  DebugSignalKind,
  DebugFileRef,
  DebugSignal,
  DebugContext,
} from '../core/debug/DebugContext';
