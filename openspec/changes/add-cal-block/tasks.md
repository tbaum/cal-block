## 1. Skeleton

- [x] 1.1 pnpm workspace root: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json` (strict, ESM, NodeNext), `.nvmrc` (24), Vitest workspace config, root scripts `build`, `test`, `typecheck`
- [x] 1.2 `packages/core` with module stubs (`config`, `dates`, `sources`, `occurrences`, `plan`, `google`, `horizon`, `paths`) and one passing Vitest test
- [x] 1.3 `apps/sync` CLI entry with `--dry-run` flag parsing, bundled by esbuild to `dist/sync.cjs`
- [x] 1.4 `apps/desktop` electron-vite app (main, preload, vanilla renderer) showing an empty settings window
- [x] 1.5 `pnpm build` and `pnpm test` green from a clean checkout

## 2. Core logic

- [x] 2.1 Config + paths: load/save `config.json` with defaults and schema validation
- [x] 2.2 Keychain secret store with in-memory fake
- [x] 2.3 ICS parsing and recurrence expansion within the window (`ical.js`), tests for RRULE, EXDATE, overridden instance, all-day, time zones
- [x] 2.4 Busy filter (cancelled, transparent, declined by owner) with tests
- [x] 2.5 Blocker identity and content hash
- [x] 2.6 `planChanges` (create/update/delete, failure isolation, removed source) with tests
- [x] 2.7 Beyond-horizon block planning with tests (window end moves daily)

## 3. Adapters

- [x] 3.1 ICS source fetcher (http/https/webcal)
- [x] 3.2 iCloud CalDAV source via `tsdav` (calendar discovery, time-range fetch)
- [x] 3.3 Google Calendar adapter: list marked blockers, insert/patch/delete with backoff, create blocker calendar
- [x] 3.4 Google OAuth loopback flow and token refresh

## 4. Sync CLI

- [x] 4.1 Run pipeline in core (`runSync`): lock, read config/secrets, sources, plan, apply or dry-run result; CLI prints it
- [x] 4.2 Status file and log with secret redaction
- [x] 4.3 End-to-end test against fake sources and fake Google (idempotent second run)

## 5. Desktop app

- [x] 5.1 Typed IPC API in preload
- [x] 5.2 Google connect/disconnect UI
- [x] 5.3 Source list: add/edit/remove/enable, iCloud calendar discovery, "Test"
- [x] 5.4 Sync settings: horizon, title, interval, start at login
- [x] 5.5 Menu bar: hidden Dock icon, tray with template icons (normal/error), menu with status, "Jetzt synchronisieren", "Einstellungen…", "Beenden"
- [x] 5.6 Scheduler in main process: run on start, interval timer, run on wake if overdue, re-arm on interval change; tests with fake clock
- [x] 5.7 Login item toggle via `setLoginItemSettings`

## 6. Packaging

- [ ] 6.1 electron-builder unsigned `.app`/`.dmg` with `LSUIElement` (menu bar only)
- [ ] 6.2 README: Google OAuth client setup, iCloud app-specific password, install
