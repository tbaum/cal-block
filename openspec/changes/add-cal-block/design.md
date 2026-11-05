## Context

Personal macOS tool for one user. Sources: Google calendars via secret iCal address, other ICS feeds, iCloud calendars. Target: a dedicated Google "Blocker" calendar that others see as free/busy. Decided by the user: Electron + TypeScript app, separate TypeScript sync script, iCloud via CalDAV, dedicated blocker calendar, horizon 60 days (configurable) with everything beyond blocked by a daily all-day recurring event, cancelled/free/declined occurrences release the slot, schedule configurable from the app, minimal UI.

## Goals / Non-Goals

**Goals:**
- Correct, idempotent mirroring of busy time, including recurrence exceptions and time zones.
- Fail safe: an unreachable source never wipes its blockers.
- Headless sync that runs without the app.

**Non-Goals:**
- Two-way sync, copying titles/details, per-source titles, previews.
- Local-only (non-iCloud) Apple calendars via EventKit.
- Windows/Linux, code signing / notarization, auto-update.
- Merging overlapping blockers.

## Decisions

### Workspace layout
pnpm workspace: `packages/core` (pure logic + adapters), `apps/sync` (CLI entry, bundled by esbuild to one `sync.cjs`), `apps/desktop` (electron-vite: main, preload, renderer). Core has no Electron dependency so the CLI stays small. Alternative: one package with two entries — rejected, the boundary keeps Electron out of the CLI.

### Core pipeline
`readSources → expandOccurrences → filterBusy → planChanges(desired, existing) → applyChanges`. `planChanges` is a pure function (desired blockers vs. existing blockers → creates/updates/deletes) and carries most tests. Google and source access sit behind small interfaces with in-memory fakes for tests.

### Parsing and recurrence: `ical.js`
Handles RRULE/EXDATE/RECURRENCE-ID overrides and VTIMEZONE reliably. Alternative `node-ical` — weaker with overridden instances. CalDAV via `tsdav` with a server-side time-range query; returned objects are parsed with the same `ical.js` path as ICS.

### Identity and change detection, no local state
Private extended properties on each blocker: `calblock=1`, `calblockKey=sha256(sourceId|UID|RECURRENCE-ID or occurrence start)` (truncated), `calblockSource=<sourceId>`, `calblockHash=sha256(start|end|allDay|title)`. Existing blockers are listed with `privateExtendedProperty=calblock=1`, `singleEvents=false`, bounded by the window. Google itself is the state store — no local DB to drift. Alternative local SQLite map — rejected, more failure modes.

### Failure isolation
`planChanges` only deletes blockers whose `calblockSource` was read successfully in this run, or whose source no longer exists in the config.

### Beyond-horizon block
One event with `calblockKey=horizon`, all-day, `RRULE:FREQ=DAILY`, start = window end date. Fetched separately by key (no time bounds) and patched when its start date differs.

### Google auth and scope
User-provided OAuth client of type "Desktop", loopback redirect on `127.0.0.1:<random port>`, scope `https://www.googleapis.com/auth/calendar.app.created` (create and manage only calendars the app created). The app creates the calendar "Blocker" on first connect and stores its id in config. Alternative full `calendar` scope — broader than needed.

### Config, secrets, status
- Config: `~/Library/Application Support/cal-block/config.json` (sources without secrets, horizon, title, interval, schedule on/off, Google client id, calendar id).
- Secrets: macOS Keychain via `@napi-rs/keyring` (N-API, works under Node and Electron), service `cal-block`, accounts `google-refresh-token`, `google-client-secret`, `source:<id>` (ICS URL or app password). Electron `safeStorage` rejected — the CLI cannot decrypt it.
- Status: `status.json` next to config; log: `~/Library/Logs/cal-block/sync.log`, truncated above 1 MB.
- Lock: `sync.lock` with PID; stale if the PID is not alive.

### Scheduling
App writes `~/Library/LaunchAgents/com.github.tbaum.cal-block.sync.plist` with `StartInterval`, `RunAtLoad`, stdout/stderr to the log dir, and loads it via `launchctl bootstrap gui/<uid>` / `bootout`. `ProgramArguments`: packaged app → its Electron binary with `ELECTRON_RUN_AS_NODE=1` and the bundled `sync.cjs` (no Node install needed); dev → current `node` absolute path and the built `sync.cjs`. launchd over cron: runs missed intervals after sleep, per-user, no crontab. "Sync now" spawns the same command.

### Rate limits
Writes run sequentially with exponential backoff on 403 `rateLimitExceeded` / 429. Expected volume is tens of events per run.

### Renderer
Vanilla TypeScript + plain HTML/CSS, `contextIsolation`, preload exposes a typed IPC API. Alternative React — unnecessary for one settings screen.

## Risks / Trade-offs

- [Google iCal secret URL feeds lag up to several hours behind Google] → documented; use Google API source later if it matters.
- [App-specific iCloud password revoked] → source fails, blockers stay, status shows the error.
- [User deletes a blocker by hand] → recreated on next run (expected).
- [`calendar.app.created` scope unavailable for the OAuth client] → fall back to `calendar` scope; config keeps the calendar id either way.
- [Unsigned app blocked by Gatekeeper] → personal use, open via right-click once.
- [Daily recurring horizon event pattern looks heavy in month view] → accepted by user (E1b).

## Migration Plan

New project, nothing to migrate. Rollback: disable schedule in the app, delete the blocker calendar.

## Open Questions

- none blocking the skeleton
