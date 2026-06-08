import { describe, expect, it } from 'vitest';
import { SubagentRegistry } from './SubagentRegistry';
import { DEFAULT_SUBAGENTS } from './DefaultSubagents';

describe('SubagentRegistry', () => {
  it('registers and retrieves all default subagents', () => {
    const registry = new SubagentRegistry();
    DEFAULT_SUBAGENTS.forEach(d => registry.register(d));
    expect(registry.getAll()).toHaveLength(DEFAULT_SUBAGENTS.length);
  });

  it('get() returns correct definition by role', () => {
    const registry = new SubagentRegistry();
    DEFAULT_SUBAGENTS.forEach(d => registry.register(d));
    const def = registry.get('search');
    expect(def.role).toBe('search');
    expect(def.displayName).toBe('Search');
  });

  it('tryGet() returns undefined for unknown role', () => {
    const registry = new SubagentRegistry();
    expect(registry.tryGet('search')).toBeUndefined();
  });

  it('get() throws for unregistered role', () => {
    const registry = new SubagentRegistry();
    expect(() => registry.get('planner')).toThrow("SubagentDefinition for role 'planner' not found");
  });

  it('getAll() returns 9 entries for default subagents', () => {
    const registry = new SubagentRegistry();
    DEFAULT_SUBAGENTS.forEach(d => registry.register(d));
    expect(registry.getAll()).toHaveLength(9);
  });
});
