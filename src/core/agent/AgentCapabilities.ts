export class AgentCapabilities {
  constructor(
    readonly canEditFiles: boolean,
    readonly canRunShell: boolean,
    readonly canSearchWeb: boolean,
    readonly supportsStreaming: boolean,
  ) { }

  static none(): AgentCapabilities {
    return new AgentCapabilities(false, false, false, false);
  }

  supports(required: Partial<AgentCapabilities>): boolean {
    return Object.entries(required).every(
      ([key, val]) => (this as Record<string, unknown>)[key] === val,
    );
  }
}
