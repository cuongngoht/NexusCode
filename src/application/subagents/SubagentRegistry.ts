import type { SubagentDefinition } from './SubagentDefinition';
import type { SubagentRole } from './SubagentResultStore';

export class SubagentRegistry {
  private readonly map = new Map<SubagentRole, SubagentDefinition>();

  register(def: SubagentDefinition): void {
    this.map.set(def.role, def);
  }

  get(role: SubagentRole): SubagentDefinition {
    const def = this.map.get(role);
    if (!def) throw new Error(`SubagentDefinition for role '${role}' not found`);
    return def;
  }

  tryGet(role: SubagentRole): SubagentDefinition | undefined {
    return this.map.get(role);
  }

  getAll(): SubagentDefinition[] {
    return [...this.map.values()];
  }
}
