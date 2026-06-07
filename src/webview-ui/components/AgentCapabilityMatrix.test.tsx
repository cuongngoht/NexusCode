import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { I18nContext, LOCALES } from '../i18n';
import type { AgentModeCapability, AgentRecommendation } from '../messages';
import { AgentCapabilityMatrix } from './AgentCapabilityMatrix';

const matrix: AgentModeCapability[] = [
  { agentId: 'claude', mode: 'edit', fit: 'best', reason: 'Strong edit support.' },
  { agentId: 'codex', mode: 'edit', fit: 'good', reason: 'Strong reasoning support.' },
  { agentId: 'gemini', mode: 'edit', fit: 'limited', reason: 'Cannot run shell commands.' },
  { agentId: 'gemini', mode: 'test', fit: 'limited', reason: 'Cannot run shell commands.' },
  { agentId: 'claude', mode: 'test', fit: 'best', reason: 'Can run shell commands.' },
];

const recommendations: AgentRecommendation[] = [
  {
    mode: 'edit',
    recommended: 'claude',
    alternatives: ['codex'],
    limited: ['gemini'],
    unavailable: ['copilot', 'aider', 'custom'],
  },
  {
    mode: 'test',
    recommended: 'claude',
    alternatives: [],
    limited: ['gemini'],
    unavailable: ['codex', 'copilot', 'aider', 'custom'],
  },
];

function renderComponent(
  props: Partial<ComponentProps<typeof AgentCapabilityMatrix>> = {},
) {
  const onProviderChange = vi.fn();
  render(
    <I18nContext.Provider value={LOCALES.en}>
      <AgentCapabilityMatrix
        mode="edit"
        provider="gemini"
        availableProviders={['claude', 'codex', 'gemini']}
        matrix={matrix}
        recommendations={recommendations}
        onProviderChange={onProviderChange}
        {...props}
      />
    </I18nContext.Provider>,
  );
  return { onProviderChange };
}

describe('AgentCapabilityMatrix component', () => {
  it('renders the recommended provider for the selected mode', () => {
    renderComponent();

    expect(screen.getByText('Recommended for Build Agent: Claude')).toBeTruthy();
    expect(screen.getByText('Also good: Codex')).toBeTruthy();
  });

  it('Use recommended calls onProviderChange', () => {
    const { onProviderChange } = renderComponent();

    fireEvent.click(screen.getByRole('button', { name: 'Use recommended' }));

    expect(onProviderChange).toHaveBeenCalledWith('claude');
  });

  it('expands and collapses the matrix', () => {
    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: 'View capability matrix' }));
    expect(screen.getByRole('table')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Hide capability matrix' }));
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows a warning when the selected provider is limited', () => {
    renderComponent({ mode: 'test', provider: 'gemini' });

    expect(screen.getByText('Current provider Gemini is limited for Test Agent.')).toBeTruthy();
  });
});
