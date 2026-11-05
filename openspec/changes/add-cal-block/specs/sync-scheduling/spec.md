## ADDED Requirements

### Requirement: In-app periodic sync
The menu bar app SHALL run the sync itself on a configurable interval (default 60 minutes) while it is running. There is no separate background service.

#### Scenario: Interval elapsed
- **WHEN** the app is running and the interval has elapsed since the last run
- **THEN** the app starts a sync

#### Scenario: Change interval
- **WHEN** the user changes the interval to 30 minutes
- **THEN** the next run is scheduled 30 minutes after the last run, without restarting the app

#### Scenario: Wake from sleep
- **WHEN** the Mac wakes up and the last run is older than the interval
- **THEN** the app starts a sync immediately

#### Scenario: App start
- **WHEN** the app starts
- **THEN** it starts a sync immediately

### Requirement: Start at login
The app SHALL offer "start at login" (default on) and register itself as a macOS login item accordingly.

#### Scenario: Enable start at login
- **WHEN** the user enables "start at login"
- **THEN** the app is registered as a hidden login item and starts in the menu bar after the next login

### Requirement: Single run at a time
Only one sync SHALL run at a time across the app and the CLI. A run that finds another live run SHALL exit without doing anything; a lock left by a dead process SHALL be taken over.

#### Scenario: Concurrent start
- **WHEN** "Sync now" is chosen while a scheduled run is active
- **THEN** no second run starts and the menu shows "running"

### Requirement: Run status and log
Each run SHALL write a status file (start, end, outcome, per-source result, counts of created/updated/deleted blockers, error messages) and append to a log file in `~/Library/Logs/cal-block`. Secrets MUST NOT appear in status or log.

#### Scenario: Successful run
- **WHEN** a run finishes
- **THEN** the status file contains its end time, outcome and change counts

### Requirement: Developer CLI
A CLI SHALL run the same sync once from the terminal, using the same config file and Keychain entries, with `--dry-run` support. It is a developer and diagnostic tool, not the production scheduler.

#### Scenario: CLI run while app is closed
- **WHEN** the CLI runs and the app is not running
- **THEN** the sync runs to completion using config and Keychain
