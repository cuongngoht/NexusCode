# Step 5: Event & Messaging System

## Goal
Detect how different parts of the system communicate asynchronously — event buses, message queues,
pub/sub systems, or reactive streams.

## Search Patterns

Search source files for:

### Event Bus / In-process
- Class or interface names: `EventBus`, `EventEmitter`, `MessageBus`, `PubSub`, `Dispatcher`
- Method calls: `.emit(`, `.publish(`, `.dispatch(`, `.subscribe(`, `.on(`, `.listen(`
- Type names: `*Event`, `DomainEvent`, `AppEvent`, `*Message`

### External Messaging
- Package names in deps: `amqplib`, `kafkajs`, `nats`, `redis` (pub/sub), `bull`, `bullmq`, `mqtt`
- Config files: `rabbitmq.conf`, `kafka.properties`

### Reactive / Stream
- Package names: `rxjs`, `most`, `xstream`, `bacon`
- Patterns: `.pipe(`, `Observable`, `Subject`, `BehaviorSubject`

## What to Record

1. Find the file that **defines** the event bus interface or base class.
2. Find the file that **lists** all event/message types (union type, enum, or registry).
3. Note the **emit** sites (producers) and **subscription** sites (consumers).
4. Note whether events are typed or dynamic strings.

## Writes

- `architecture.eventBus` — path to event bus definition file, or `null`
- `confidence.eventBus`
- Append to `integrationNotes`:
  - "Event bus is at `<path>`. New features should emit events by importing from `<events-file>`."
  - "To add a new event type: `<brief instruction based on what you found>`"
- Write findings to `.nexus/discovery/integration-points.md` under **Event & Messaging** section
