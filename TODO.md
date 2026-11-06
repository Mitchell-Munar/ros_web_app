## Phase 0: Scaffold and guardrails
- [x] Vite + React + strict TypeScript, Vitest, ESLint
- [x] Layered modules with index.ts public APIs
- [x] Dependency boundaries and restricted imports
- [x] No explicit any, environment reads restricted to app/config, no React in core/types
- [x] npm run lint validation
- [x] Exact Foxglove dependency versions and synchronized lockfile
- [x] Environment template and local override exclusion
- [x] Zustand low-rate session state
- [ ] Manual browser: mock ping and StrictMode single socket
- [ ] Manual robot: real discovery, ping, interrupted calls and reconnect

Follow-up: expand controlled-transport lifecycle tests.
