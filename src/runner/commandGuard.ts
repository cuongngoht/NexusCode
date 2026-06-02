const UNSAFE_PATTERN = /[;&|`$<>\\!]/;

export class CommandGuard {
  static validate(command: string): void {
    if (!command || command.trim() === '') {
      throw new Error('Command must not be empty.');
    }
    if (UNSAFE_PATTERN.test(command)) {
      throw new Error(
        `Command contains unsafe shell metacharacters: "${command}". ` +
          'Use an absolute path or a simple executable name.',
      );
    }
  }
}
