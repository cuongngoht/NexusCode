import { describe, it, expect, vi } from 'vitest';
import { EnrichmentConsentGate } from '../EnrichmentConsentGate';

function makeFakeMemento(initial: Record<string, unknown> = {}) {
  const store = { ...initial };
  return {
    get: vi.fn((key: string) => store[key]),
    update: vi.fn(async (key: string, value: unknown) => { store[key] = value; }),
  };
}

describe('EnrichmentConsentGate', () => {
  it('prompts and persists granted on first call when the user chooses Enable', async () => {
    const memento = makeFakeMemento();
    const prompt = vi.fn().mockResolvedValue('Enable');
    const gate = new EnrichmentConsentGate(memento as any, prompt);

    const result = await gate.ensureConsent();

    expect(result).toBe(true);
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(memento.update).toHaveBeenCalledWith('nexus.knowledgeFacts.enrichmentConsent', 'granted');
  });

  it('prompts and persists denied when the user chooses Never', async () => {
    const memento = makeFakeMemento();
    const prompt = vi.fn().mockResolvedValue('Never');
    const gate = new EnrichmentConsentGate(memento as any, prompt);

    const result = await gate.ensureConsent();

    expect(result).toBe(false);
    expect(memento.update).toHaveBeenCalledWith('nexus.knowledgeFacts.enrichmentConsent', 'denied');
  });

  it('does not persist anything on "Not Now" — re-prompts next time', async () => {
    const memento = makeFakeMemento();
    const prompt = vi.fn().mockResolvedValue('Not Now');
    const gate = new EnrichmentConsentGate(memento as any, prompt);

    const result = await gate.ensureConsent();

    expect(result).toBe(false);
    expect(memento.update).not.toHaveBeenCalled();
  });

  it('short-circuits without re-prompting once consent was already granted', async () => {
    const memento = makeFakeMemento({ 'nexus.knowledgeFacts.enrichmentConsent': 'granted' });
    const prompt = vi.fn();
    const gate = new EnrichmentConsentGate(memento as any, prompt);

    const result = await gate.ensureConsent();

    expect(result).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
  });

  it('short-circuits without re-prompting once consent was already denied', async () => {
    const memento = makeFakeMemento({ 'nexus.knowledgeFacts.enrichmentConsent': 'denied' });
    const prompt = vi.fn();
    const gate = new EnrichmentConsentGate(memento as any, prompt);

    const result = await gate.ensureConsent();

    expect(result).toBe(false);
    expect(prompt).not.toHaveBeenCalled();
  });
});
