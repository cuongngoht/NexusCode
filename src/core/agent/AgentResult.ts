export class AgentResult {
  constructor(
    readonly exitCode: number,
    readonly stdout: string,
    readonly stderr: string,
    readonly durationMs: number,
  ) { }

  get succeeded(): boolean {
    return this.exitCode === 0;
  }
}
