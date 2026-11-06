# AGENTS.md

React + TypeScript + Vite web app that controls ROS 2 robots through `foxglove_bridge`.
Web first. Electron desktop shell and mobile are future shells around the same renderer.
Anything not stated here: ask, or add it to `TODO.md`. Do not invent it.

## Scope and workflow
* Current scope is **Phase 1**: connect, list advertised channels and services, call `/web_ping`.
* No topic subscriptions, publishing, persistence, or platform features until a phase explicitly requests them.
* Stop after each requested phase for manual testing.
* Validate with `npm run lint`, `npm run build`, `npm test`. Also check manually: real bridge, reconnect, one socket under StrictMode.
* `/web_ping` is believed to be `std_srvs/srv/Trigger`. The bridge advertisement is authoritative.

## Structure
```
src/
  app/        composition root: entry, providers, routes, layout, config, robot profiles,
              chooses real vs mock. The only place that knows about everything.
  features/   vertical slices (React). Own components, hooks, local state.
  core/       plain TypeScript, no React. One subfolder per external system.
    robot/    Foxglove client registry, handshake, capabilities, CDR decode,
              service calls, TelemetrySource interface + real + mock.
  types/      hand-written TS interfaces (ros.ts). Depends on nothing.
  shared/     generic UI and utilities with no robot knowledge. Imports nothing from the project.
```
Shell code (Electron main/preload, packaging) will live outside `src/`.

## Dependency rules (enforced by lint, violations fail `npm run lint`)
1. Imports point down only: `app → features → core → types`. `shared` is usable by any layer.
2. No React in `core/` or `types/`.
3. Features never import other features. Shared needs go to `core/` or `shared/`.
4. Each module is imported only through its `index.ts`. No deep imports.
   Barrel files are for module boundaries only, never for convenience inside a module.
5. Features depend on interfaces (`TelemetrySource`, future repositories), never on concrete implementations.
   Only `app/` instantiates real or mock.
6. `import.meta.env` is read only in `app/config`. Config is injected.
7. A feature is deletable: removing it touches only its registration in `app/`.
8. Inside features, logic (hooks, stores) is separate from presentation (components).
9. Layout and navigation live in `app/`, not in features.
10. Features never call `window.electron`, Tauri, or Node APIs. Native capabilities go through a future `PlatformServices` port.

## Network and config
* `foxglove_bridge` binds 0.0.0.0:8765 on the robot. Never use 0.0.0.0 as a client target.
* Robots are configured as **profiles** (`id`, `name`, `url`). Phase 1 has one profile, whose URL defaults to
  `VITE_FOXGLOVE_URL`, falling back to `ws://localhost:8765`. Remote testing sets `ws://<robot-ip>:8765` in `.env.local`.
* Only TCP 8765 is needed from the browser. DDS settings are irrelevant to the web app.
* The ROS 2 Lyrical stack lives in a separate backend workspace. Never assume access to its packages, params, or .msg sources.

## Protocol (verified: ROS 2 Lyrical, `foxglove_bridge` 3.6.0, Foxglove SDK server)
* Use `new WebSocket(url, 'foxglove.sdk.v1')`, then wrap it with `@foxglove/ws-protocol` `FoxgloveClient`.
* Never use `foxglove.websocket.v1` or the client's default subprotocol constant. The bridge rejects them with
  HTTP 400 "Missing expected sec-websocket-protocol header" even when the header is present.
* Stay on `foxglove.sdk.v1` (inline channel schemas). Do not negotiate `foxglove.sdk.v1.1`
  (connection-scoped schema table, needs client support). Recheck when upgrading the bridge or client.
* This is Foxglove WebSocket, not rosbridge/roslibjs. Control messages are JSON, ROS 2 payloads are binary CDR.
  Decode with `@foxglove/rosmsg` + `@foxglove/rosmsg2-serialization`. No custom CDR parser. No BSON or Protobuf.
* Use advertised schemas for topics and services. Support request/response descriptors and legacy
  `requestSchema`/`responseSchema`. An empty schema is valid and differs from an absent one.
  If required schemas are absent or unsupported, report it. Never guess from a ROS type name or local ROS install.
* Check `serverInfo.capabilities` before using services or publishing. Disable the matching UI otherwise, and verify encodings.
* Pin all direct `@foxglove/*` dependencies to exact versions and keep `package-lock.json` in sync.
  A successful handshake does not prove service serialization compatibility.
* Keep raw `serverInfo` and service-advertisement console logs available while validating against the real bridge.
* Reference: https://github.com/foxglove/foxglove-sdk/blob/main/rust/foxglove/src/websocket/handshake.rs
* Handshake failures: diagnose first, before CDR or schemas. Inspect the WebSocket upgrade request and bridge logs
  (expect HTTP 101 and the agreed subprotocol). Open the Vite app URL, never the bridge port, in the browser.

## Telemetry architecture
* **One client per robot ID**, managed by a registry in `core/robot`. Per-robot clients are singletons that survive
  StrictMode double-mount. Hooks only subscribe and unsubscribe.
* `TelemetrySource` and service calls are scoped to a robot session, never global. Features get the current robot
  from context provided by `app/`, and never assume there is only one.
* Decode once in the connection layer, then dispatch to subscribers.
* High-rate data (/odom, /tf, images, point clouds) never goes in React state, context, or Zustand. Keep latest values
  in refs or an external store, exposed via `useSyncExternalStore` or a throttled (~10 Hz) snapshot.
  Canvas/WebGL read directly from subscriber callbacks.
* Low-rate state (connection status, topic list, capabilities) may live in Zustand.
* Persisted server data (future) uses a server-state cache (TanStack Query) behind repository interfaces,
  not Zustand and not the telemetry store.

## Types and mocks
* Hand-write TS interfaces for each message actually used in `src/types/ros.ts`. Validate and narrow decoded data
  at the decode boundary. No `any`.
* Real and mock sources implement the same `TelemetrySource` interface. `VITE_USE_MOCK=true` selects mock in `app/`.
  Mocks emit realistic rates.

## Reserved rules (not built yet, follow when added)
* **Platform port:** `PlatformServices` (files, dialogs, settings, notifications, logging) injected by `app/`.
  Browser implementation first, Electron later. The web build must stay fully runnable in a plain browser.
* **Persistence:** repository interfaces (e.g. `MissionRepository`) in `core/persistence/`. Adapters: IndexedDB (web),
  SQLite via Electron main (desktop), HTTP (future server). The browser never talks to a database directly.
* **Input intents:** features consume abstract intents ("drive", "stop"). Keyboard, touch, and gamepad are input adapters.
* **Runtime robot profiles:** profiles come from a settings store, with `VITE_*` as the default.