export type ActivityKind =
  | 'read'
  | 'edit'
  | 'bash'
  | 'write'
  | 'todo'
  | 'search'
  | 'tool_call'
  | 'plain';

export type ActivityStatus = 'running' | 'done' | 'error';

export interface ParsedActivity {
  kind: ActivityKind;
  status: ActivityStatus;
  label: string;
  raw: string;
}

export interface IOutputParser {
  parse(chunk: string): ParsedActivity[];
  flush?(): ParsedActivity[];
}
