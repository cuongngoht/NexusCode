export interface ArchitectureScore {
  overall: number;
  coupling: number;
  cohesion: number;
  abstraction: number;
  testability: number;
  extensibility: number;
  readability: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export type ArchitectureVerdict =
  | 'healthy'
  | 'acceptable-with-debt'
  | 'needs-refactor'
  | 'architecture-blocker';
