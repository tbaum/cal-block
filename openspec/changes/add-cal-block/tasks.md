## 1. Skeleton

- [ ] 1.1 pnpm workspace root: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json` (strict, ESM, NodeNext), `.nvmrc` (24), Vitest workspace config, root scripts `build`, `test`, `typecheck`
- [ ] 1.2 `packages/core` with module stubs (`config`, `sources`, `occurrences`, `busy`, `plan`, `google`, `horizon`, `paths`) and one passing Vitest test
- [ ] 1.3 `apps/sync` CLI entry with `--dry-run` flag parsing, bundled by esbuild to `dist/sync.cjs`
- [ ] 1.4 `apps/desktop` electron-vite app (main, preload, vanilla renderer) showing an empty settings window
- [ ] 1.5 `pnpm build` and `pnpm test` green from a clean checkout

## 2. Core logic

- [ ] 2.1 Config + paths: load/save `config.json` with defaults and schema validation
- [ ] 2.2 Keychain secret store with in-memory fake
- [ ] 2.3 ICS parsing and recurrence expansion within the window (`ical.js`), tests for RRULE, EXDATE, overridden instance, all-day, time zones
- [ ] 2.4 Busy filter (cancelled, transparent, declined by owner) with tests
- [ ] 2.5 Blocker identity and content hash
- [ ] 2.6 `planChanges` (create/update/delete, failure isolation, removed source) with tests
- [ ] 2.7 Beyond-horizon block planning with tests (window end moves daily)

## 3. Adapters

- [ ] 3.1 ICS source fetcher (http/https/webcal)
- [ ] 3.2 iCloud CalDAV source via `tsdav` (calendar discovery, time-range fetch)
- [ ] 3.3 Google Calendar adapter: list marked blockers, insert/patch/delete with backoff, create blocker calendar
- [ ] 3.4 Google OAuth loopback flow and token refresh

## 4. Sync CLI

- [ ] 4.1 Run pipeline: lock, read config/secrets, sources, plan, apply or dry-run print
- [ ] 4.2 Status file and log with secret redaction
- [ ] 4.3 End-to-end test against fake sources and fake Google (idempotent second run)

## 5. Desktop app

- [ ] 5.1 Typed IPC API in preload
- [ ] 5.2 Google connect/disconnect UI
- [ ] 5.3 Source list: add/edit/remove/enable, iCloud calendar discovery, "Test"
- [ ] 5.4 Sync settings: horizon, title, interval, schedule on/off
- [ ] 5.5 launchd agent install/update/remove (`launchctl bootstrap`/`bootout`) with plist generation tests
- [ ] 5.6 Status view and "Sync now"

## 6. Packaging

- [ ] 6.1 electron-builder unsigned `.app`/`.dmg` with bundled `sync.cjs`; plist points to Electron binary with `ELECTRON_RUN_AS_NODE=1`
- [ ] 6.2 README: Google OAuth client setup, iCloud app-specific password, install
