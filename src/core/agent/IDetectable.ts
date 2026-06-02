export interface DetectionResult {
  available: boolean;
  version?: string;
  path?: string;
  reason?: string;
}

export interface IDetectable {
  detect(): Promise<DetectionResult>;
}
