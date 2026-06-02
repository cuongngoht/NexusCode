export interface IStreamable {
  onStdout(handler: (chunk: string) => void): void;
  onStderr(handler: (chunk: string) => void): void;
  onComplete(handler: (exitCode: number) => void): void;
}
