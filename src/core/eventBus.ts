import { NexusEvent, NexusEventKind } from './types';

type Listener = (event: NexusEvent) => void;

export class EventBus {
  private readonly listeners = new Map<NexusEventKind | '*', Set<Listener>>();

  on(kind: NexusEventKind | '*', listener: Listener): void {
    let set = this.listeners.get(kind);
    if (!set) {
      set = new Set();
      this.listeners.set(kind, set);
    }
    set.add(listener);
  }

  off(kind: NexusEventKind | '*', listener: Listener): void {
    this.listeners.get(kind)?.delete(listener);
  }

  emit(event: NexusEvent): void {
    this.listeners.get(event.kind)?.forEach(l => l(event));
    this.listeners.get('*')?.forEach(l => l(event));
  }
}

export const globalBus = new EventBus();
