# Step 6: Communication & IPC

## Goal
Detect how the application exposes or consumes interfaces — UI protocol, REST/GraphQL/RPC APIs,
inter-process communication, or plugin messaging.

## Common Patterns to Search

### UI / Host ↔ Renderer Communication
- `postMessage`, `onmessage`, `addEventListener('message'`
- `ipcMain`, `ipcRenderer` (Electron)
- `onDidReceiveMessage` (VS Code webview)
- Files named `messages.ts`, `protocol.ts`, `ipc.ts`, `bridge.ts`

### HTTP API
- Router files: `routes/`, `api/`, `controllers/` with REST-like method names (`get`, `post`, `put`, `delete`)
- Framework decorators: `@Get`, `@Post`, `@Controller` (NestJS, Spring, ASP.NET)
- OpenAPI/Swagger: `swagger.yaml`, `openapi.yaml`, `openapi.json`

### GraphQL
- Schema files: `*.graphql`, `schema.graphql`
- Code-first: `@Query`, `@Mutation`, `@Resolver`

### gRPC / RPC
- Proto files: `*.proto`
- Package deps: `@grpc/grpc-js`, `grpc`, `connectrpc`

### WebSocket / Realtime
- Package deps: `socket.io`, `ws`, `uWebSockets.js`
- Patterns: `io.on('connection'`, `ws.on('message'`

## What to Record

1. Identify the **primary communication layer** (which pattern above is central to this project).
2. Find the file that **defines the message contract** (typed messages, proto schema, API spec).
3. Note where new message types / routes / endpoints should be registered.

## Writes

- `architecture.communicationProtocol` — one-line description, or `null`
- `paths.uiRoots[]` — UI or renderer source directories, if any
- `confidence.communicationProtocol`
- Append to `integrationNotes`:
  - Where the API/message contract is defined
  - How to extend it for new features
- Write to `.nexus/discovery/integration-points.md` under **Communication Protocol** section
