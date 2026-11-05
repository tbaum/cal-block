## Why

Busy time is spread over several calendars (Google via secret iCal address, other ICS feeds, iCloud). People who book against the Google calendar only see part of it and book into slots that are actually taken. A small local tool should mirror all busy time as anonymous blockers into one dedicated Google calendar and keep it current.

## What Changes

- New pnpm workspace `cal-block` with three packages: `packages/core` (sync logic), `apps/sync` (developer CLI with `--dry-run`), `apps/desktop` (Electron menu bar app: settings, status and the periodic sync itself).
- Read sources: ICS URLs and iCloud calendars via CalDAV (Apple ID + app-specific password).
- Expand recurrences, drop events that are cancelled, marked free, or declined by the owner.
- Write one "Busy" blocker per busy source occurrence into a dedicated Google blocker calendar within a configurable horizon (default 60 days); update and delete blockers when the source changes.
- Block everything beyond the horizon with one daily all-day recurring blocker starting at the first day after the horizon.
- Run as an invisible menu bar app (no Dock icon, no window unless opened), started at login, syncing periodically (default hourly, configurable) and on wake; manual "Sync now" from the menu.
- Keep secrets (Google refresh token, CalDAV password, secret ICS URLs) in the macOS Keychain.

## Capabilities

### New Capabilities
- `calendar-sources`: configuring ICS and iCloud CalDAV sources and reading busy occurrences from them.
- `blocker-sync`: reconciling busy occurrences into blockers in the Google target calendar, including the beyond-horizon block.
- `sync-scheduling`: periodic in-app sync, start at login, locking, status and logs, developer CLI.
- `settings-app`: the menu bar app UI: menu with status and actions, settings window for sources, Google connection and sync options.

### Modified Capabilities
- none (new project)

## Impact

- New repository `github.com/tbaum/cal-block`.
- External APIs: Google Calendar API v3 (OAuth, own Google Cloud OAuth client of type "Desktop"), iCloud CalDAV, arbitrary ICS URLs.
- Local system: macOS login items, `~/Library/Application Support/cal-block`, `~/Library/Logs/cal-block`, macOS Keychain.
- Dependencies: `ical.js`, `tsdav`, `@googleapis/calendar`, `google-auth-library`, `@napi-rs/keyring`, `electron`, `electron-vite`, `vitest`.
