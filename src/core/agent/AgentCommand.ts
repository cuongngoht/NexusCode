export class AgentCommand {
  constructor(
    readonly executable: string,
    readonly args: ReadonlyArray<string>,
    readonly env?: Readonly<Record<string, string>>,
  ) { }
}
