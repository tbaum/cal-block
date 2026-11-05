## ADDED Requirements

### Requirement: launchd user agent
The system SHALL run the sync headlessly via a launchd user agent. The agent SHALL be installed, updated and removed only by the app, with a configurable interval (default 60 minutes) and run at load.

#### Scenario: Enable schedule
- **WHEN** the user enables the schedule with interval 60 minutes
- **THEN** the app writes the agent plist with `StartInterval` 3600 to `~/Library/LaunchAgents` and loads it

#### Scenario: Change interval
- **WHEN** the user changes the interval to 30 minutes
- **THEN** the app rewrites the plist with `StartInterval` 1800 and reloads the agent

#### Scenario: Disable schedule
- **WHEN** the user disables the schedule
- **THEN** the app unloads the agent and removes the plist

### Requirement: Single run at a time
Only one sync SHALL run at a time. A run that finds another live run SHALL exit without doing anything; a lock left by a dead process SHALL be taken over.

#### Scenario: Concurrent start
- **WHEN** "sync now" is pressed while a scheduled run is active
- **THEN** the second run exits immediately and reports "already running"

### Requirement: Run status and log
Each run SHALL write a status file (start, end, outcome, per-source result, counts of created/updated/deleted blockers, error messages) and append to a log file in `~/Library/Logs/cal-block`. Secrets MUST NOT appear in status or log.

#### Scenario: Successful run
- **WHEN** a run finishes
- **THEN** the status file contains its end time, outcome and change counts

### Requirement: Headless config and secrets
The sync CLI SHALL read the same config file and Keychain entries as the app, and SHALL NOT require the app to be running.

#### Scenario: App closed
- **WHEN** the app is not running and the agent fires
- **THEN** the sync runs to completion using config and Keychain
