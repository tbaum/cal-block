## Why

Busy time is spread over several calendars (Google via secret iCal address, other ICS feeds, iCloud). People who book against the Google calendar only see part of it and book into slots that are actually taken. A small local tool should mirror all busy time as anonymous blockers into one dedicated Google calendar and keep it current.

## What Changes

- New pnpm workspace `cal-block` with three packages: `packages/core` (sync logic), `apps/sync` (headless CLI run by launchd), `apps/desktop` (Electron settings/status app).
- Read sources: ICS URLs and iCloud calendars via CalDAV (Apple ID + app-specific password).
- Expand recurrences, drop events that are cancelled, marked free, or declined by the owner.
- Write one "Busy" blocker per busy source occurrence into a dedicated Google blocker calendar within a configurable horizon (default 60 days); update and delete blockers when the source changes.
- Block everything beyond the horizon with one daily all-day recurring blocker starting at the first day after the horizon.
- Run the sync periodically (default hourly) via a launchd user agent that the app installs, configures and removes; manual "sync now" from the app.
- Keep secrets (Google refresh token, CalDAV password, secret ICS URLs) in the macOS Keychain.

## Capabilities

### New Capabilities
- `calendar-sources`: configuring ICS and iCloud CalDAV sources and reading busy occurrences from them.
- `blocker-sync`: reconciling busy occurrences into blockers in the Google target calendar, including the beyond-horizon block.
- `sync-scheduling`: periodic headless execution via launchd, locking, status and logs.
- `settings-app`: the Electron app for configuration, Google connection, schedule control and status display.

### Modified Capabilities
- none (new project)

## Impact

- New repository `github.com/tbaum/cal-block`.
- External APIs: Google Calendar API v3 (OAuth, own Google Cloud OAuth client of type "Desktop"), iCloud CalDAV, arbitrary ICS URLs.
- Local system: `~/Library/LaunchAgents`, `~/Library/Application Support/cal-block`, `~/Library/Logs/cal-block`, macOS Keychain.
- Dependencies: `ical.js`, `tsdav`, `@googleapis/calendar`, `google-auth-library`, `@napi-rs/keyring`, `electron`, `electron-vite`, `vitest`.
