# ROS bridge Phase 1

Requires Node.js 22 and npm. Run `npm install`, `npm run typecheck`, `npm run build`, then `npm run dev`. Commit the generated package-lock.json after installation. Copy `.env.example` to `.env.local`; use `VITE_USE_MOCK=true` for a socket-free demo. For a remote robot set `VITE_FOXGLOVE_URL=ws://<robot-ip>:8765`. Restart Vite after environment changes. Only browser TCP 8765 is needed.

No topic subscriptions or publishing are implemented. Missing service schemas produce an error rather than a guessed Trigger definition. Raw bridge discovery messages appear in the browser console.

## Manual checklist

- Mock mode: inspect service table, call ping, verify response and roughly 200 ms latency.
- Real mode: inspect serverInfo and service advertisements in console; verify channel and service tables.
- Restart bridge; verify reconnect, cleared stale tables, and refreshed discovery.
- Check missing service capability disables the button; missing schemas produce an explanatory error.
- Verify remote URL displayed matches .env.local.
- Under React StrictMode verify only one open WebSocket and no subscribe/publish frames.
- Interrupt a service call; verify error and ability to retry after reconnect.

## Verification

`npm run build` checks strict TypeScript and builds production assets. `npm test` runs focused mock, response validation, and CDR round-trip checks using Node's built-in test runner. Real bridge and browser behavior require the manual checklist above.

## Architecture and Phase 0

`src/app` owns configuration, robot session context, composition, and layout.
`src/features/diagnostics` separates hooks from presentation and consumes the session interface.
`src/core/robot` owns transport, decoding, mock implementation, registry, and vanilla Zustand snapshots.
`src/types` holds ROS contracts; `src/shared` is reserved for generic utilities.
Cross-module imports use public index files. Sessions are keyed by robot ID and survive React subscription cleanup.

Run `npm run lint`, `npm run build`, and `npm test` (Vitest) before manual testing.
The real bridge checklist above remains required; automated checks do not establish robot compatibility.
