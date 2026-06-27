export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskScore {
  level: RiskLevel;
  score: number;
  factors: string[];
}

export const RISK_ORDER: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function isRiskAtOrAbove(actual: RiskLevel, threshold: RiskLevel): boolean {
  return RISK_ORDER[actual] >= RISK_ORDER[threshold];
}
