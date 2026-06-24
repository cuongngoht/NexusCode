import type { FileTouchEvent } from './types';

export class FileTouchCollector {
  private readonly events: FileTouchEvent[] = [];

  collect(event: FileTouchEvent): void {
    this.events.push(event);
  }

  drain(): FileTouchEvent[] {
    return this.events.splice(0, this.events.length);
  }

  get size(): number {
    return this.events.length;
  }
}
