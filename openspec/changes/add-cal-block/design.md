## Context

Personal macOS tool for one user. Sources: Google calendars via secret iCal address, other ICS feeds, iCloud calendars. Target: a dedicated Google "Blocker" calendar that others see as free/busy. Decided by the user: Electron + TypeScript app, menu bar app that also runs the periodic sync (E3b, invisible: no Dock icon), CLI kept for development, iCloud via CalDAV, dedicated blocker calendar, horizon 60 days (configurable) with everything beyond blocked by a daily all-day recurring event, cancelled/free/declined occurrences release the slot, interval configurable from the app, minimal UI.

## Goals / Non-Goals

**Goals:**
- Correct, idempotent mirroring of busy time, including recurrence exceptions and time zones.
- Fail safe: an unreachable source never wipes its blockers.
- Invisible operation: menu bar only, starts at login, syncs on its own.

**Non-Goals:**
- Two-way sync, copying titles/details, per-source titles, previews.
- Local-only (non-iCloud) Apple calendars via EventKit.
- Windows/Linux, code signing / notarization, auto-update.
- Merging overlapping blockers.

## Decisions

### Workspace layout
pnpm workspace: `packages/core` (pure logic + adapters), `apps/sync` (developer CLI, bundled by esbuild to one `sync.cjs`), `apps/desktop` (electron-vite: main runs tray + scheduler + sync, preload, renderer for the settings window). Core has no Electron dependency so the CLI and tests stay plain Node. Alternative: one package with two entries — rejected, the boundary keeps Electron out of the CLI.

### Core pipeline
`readSources → expandOccurrences → filterBusy → planChanges(desired, existing) → applyChanges`. `planChanges` is a pure function (desired blockers vs. existing blockers → creates/updates/deletes) and carries most tests. Google and source access sit behind small interfaces with in-memory fakes for tests.

### Parsing and recurrence: `ical.js`
Handles RRULE/EXDATE/RECURRENCE-ID overrides and VTIMEZONE reliably. Alternative `node-ical` — weaker with overridden instances. CalDAV via `tsdav` with a server-side time-range query; returned objects are parsed with the same `ical.js` path as ICS.

### Identity and change detection, no local state
Private extended properties on each blocker: `calblock=1`, `calblockKey=sha256(sourceId|UID|RECURRENCE-ID or occurrence start)` (truncated), `calblockSource=<sourceId>`, `calblockHash=sha256(start|end|allDay|title)`. Existing blockers are listed with `privateExtendedProperty=calblock=1`, `singleEvents=false`, `timeMin` = window start and no `timeMax`, so blockers left beyond a shrunk horizon are deleted too. Google itself is the state store — no local DB to drift. Alternative local SQLite map — rejected, more failure modes.

### Failure isolation
`planChanges` only deletes blockers whose `calblockSource` was read successfully in this run, or whose source is no longer active (removed or disabled) in the config.

### Beyond-horizon block
One event with `calblockKey=horizon`, all-day, `RRULE:FREQ=DAILY`, start = window end date. Fetched separately by key (no time bounds) and patched when its start date differs.

### Occurrence semantics
- Window membership: an occurrence belongs to the window if it overlaps `[window start, window end)`; days are local calendar days (DST-safe). Blockers outside the window are neither updated nor deleted.
- Key uses the original occurrence start when there is no RECURRENCE-ID; changing a whole series' RRULE therefore yields delete + create, while moved single events and overridden instances are updates.
- All-day events map 1:1 (exclusive end date); floating times are interpreted in the system time zone; multi-day timed events become one blocker.
- Owner emails for declined detection are configured per source (`ownerEmails` in config.json); no auto-detection.

### Blocker calendar lifecycle
The calendar id is stored in config. On (re)connect the stored id is reused if it is still accessible, otherwise a new "Blocker" calendar is created and the id replaced. If the `calendar.app.created` scope is rejected for the OAuth client, the build stops and the scope question goes back to the user.

### Partial failures
Writes retry up to 5 times with exponential backoff; a run aborts after 10 minutes. Outcome in status: `ok`, `partial` (some sources or writes failed), `failed` (nothing applied, e.g. auth error).

### iCloud calendar discovery
Discovery lists all calendars whose supported components include VEVENT; no time-range probe.

### Google auth and scope
User-provided OAuth client of type "Desktop", loopback redirect on `127.0.0.1:<random port>`, scope `https://www.googleapis.com/auth/calendar.app.created` (create and manage only calendars the app created). The app creates the calendar "Blocker" on first connect and stores its id in config. Alternative full `calendar` scope — broader than needed.

### Config, secrets, status
- Config: `~/Library/Application Support/cal-block/config.json` (sources without secrets, horizon, title, sync interval, start at login, Google client id, calendar id).
- Secrets: macOS Keychain via `@napi-rs/keyring` (N-API, works under Node for the CLI and Electron for the app), service `cal-block`, accounts `google-refresh-token`, `google-client-secret`, `source:<id>` (ICS URL or app password). Electron `safeStorage` rejected — the CLI cannot decrypt it.
- Config changes from the settings window apply to the next run without restart.
- Status: `status.json` next to config; log: `~/Library/Logs/cal-block/sync.log`, truncated above 1 MB.
- Lock: `sync.lock` with PID; stale if the PID is not alive.

### Menu bar app and scheduling (E3b)
- `app.dock.hide()`, `LSUIElement` in the packaged Info.plist; a `Tray` with a template icon (normal / error variant) and a context menu: status line, "Sync now", "Settings…", "Quit". The settings window is created on demand; closing it does not quit the app.
- Scheduler in the main process: run on start, then a timer re-armed after each run with the configured interval; `powerMonitor` `resume` triggers a run if the last one is older than the interval. Interval changes re-arm the timer.
- Start at login via `app.setLoginItemSettings({ openAtLogin, openAsHidden })`.
- The sync runs in the main process by calling `packages/core` directly (no child process). Writes are network-bound, so the main process stays responsive.
- Alternatives: separate launchd job (E3a) and launchd starting the app headless (E3c) — rejected by the user in favour of a single invisible app; trade-off: no sync while the app is quit.

### Rate limits
Writes run sequentially with exponential backoff on 403 `rateLimitExceeded` / 429. Expected volume is tens of events per run.

### Renderer
Vanilla TypeScript + plain HTML/CSS, `contextIsolation`, preload exposes a typed IPC API. Alternative React — unnecessary for one settings screen.

## Risks / Trade-offs

- [Google iCal secret URL feeds lag up to several hours behind Google] → documented; use Google API source later if it matters.
- [App-specific iCloud password revoked] → source fails, blockers stay, status shows the error.
- [User deletes a blocker by hand] → recreated on next run (expected).
- [Unsigned app: Keychain asks "Always Allow" once per app build, a scheduled run can wait on that prompt] → accepted by user (E2a); status shows the run as pending/failed until confirmed.
- [Unsigned app blocked by Gatekeeper] → personal use, open via right-click once.
- [App quit or not started at login → no sync, blockers age] → start at login default on; status shows last run time.
- [Daily recurring horizon event pattern looks heavy in month view] → accepted by user (E1b).

## Migration Plan

New project, nothing to migrate. Rollback: quit the app and disable start at login, delete the blocker calendar.

## Open Questions

- Overridden instance whose original date lies beyond the window but was moved into it is not found (iteration stops at the window end). Accepted as rare.
- TZID without a matching VTIMEZONE in the feed is treated like UTC by ical.js. Google and iCloud ship VTIMEZONEs; revisit if a feed (e.g. Outlook) breaks.
