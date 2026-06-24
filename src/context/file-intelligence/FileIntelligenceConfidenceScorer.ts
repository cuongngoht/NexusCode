import type { FileTouchEvent } from './types';

export class FileIntelligenceConfidenceScorer {
  score(event: FileTouchEvent): number {
    if (event.source === 'review') return 0.8;

    if (event.source === 'debug') {
      const hasConfirmed = event.debugFindings?.some(f => f.role === 'confirmed') ?? false;
      return hasConfirmed ? 0.9 : 0.5;
    }

    if (event.source === 'edit') return 0.7;
    if (event.source === 'test') return 0.75;
    if (event.source === 'subagent') return 0.6;
    if (event.source === 'chat' || event.source === 'plan') return 0.2;

    // scan, unknown
    return 0.3;
  }

  merge(existing: number, incoming: number): number {
    const high = Math.max(existing, incoming);
    const low = Math.min(existing, incoming);
    const merged = high * 0.7 + low * 0.3;
    return Math.min(merged, 0.95);
  }
}
