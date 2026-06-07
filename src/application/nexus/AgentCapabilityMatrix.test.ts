import { describe, expect, it } from 'vitest';
import {
  buildAgentCapabilityMatrix,
  buildAgentRecommendations,
  DIRECT_AGENT_IDS,
} from './AgentCapabilityMatrix';

describe('AgentCapabilityMatrix', () => {
  it('includes all direct providers and excludes meta providers', () => {
    const matrix = buildAgentCapabilityMatrix();
    const askAgents = matrix
      .filter(row => row.mode === 'ask')
      .map(row => row.agentId);

    expect(askAgents).toEqual([...DIRECT_AGENT_IDS]);
    expect(askAgents).not.toContain('nexus');
    expect(askAgents).not.toContain('auto');
  });

  it('edit recommends claude or codex before gemini', () => {
    const [recommendation] = buildAgentRecommendations(['gemini', 'codex', 'claude'])
      .filter(r => r.mode === 'edit');

    expect(recommendation.recommended).toBe('claude');
    expect(recommendation.alternatives).toContain('codex');
    expect(recommendation.limited).toContain('gemini');
  });

  it('research recommends gemini when available', () => {
    const recommendation = buildAgentRecommendations(['claude', 'gemini'])
      .find(r => r.mode === 'research');

    expect(recommendation?.recommended).toBe('gemini');
  });

  it('does not choose unavailable best providers as primary recommendation', () => {
    const recommendation = buildAgentRecommendations(['gemini'])
      .find(r => r.mode === 'plan');

    expect(recommendation?.recommended).toBe('gemini');
    expect(recommendation?.unavailable).toContain('codex');
    expect(recommendation?.unavailable).toContain('claude');
  });

  it('can suggest a limited provider when no best or good provider is available', () => {
    const recommendation = buildAgentRecommendations(['aider'])
      .find(r => r.mode === 'ask');

    expect(recommendation?.recommended).toBe('aider');
  });

  it('marks custom as unknown and never best', () => {
    const matrix = buildAgentCapabilityMatrix();
    const customRows = matrix.filter(row => row.agentId === 'custom');

    expect(customRows.length).toBeGreaterThan(0);
    expect(customRows.every(row => row.fit !== 'best')).toBe(true);
    expect(customRows.every(row => row.fit === 'unknown')).toBe(true);
  });
});
