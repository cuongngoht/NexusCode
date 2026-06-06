export interface ICustomCommandConfigProvider {
  getCommand(): string;
  getArgs(): string[];
}
