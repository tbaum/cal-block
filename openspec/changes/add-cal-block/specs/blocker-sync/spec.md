## ADDED Requirements

### Requirement: Dedicated blocker calendar
The system SHALL write only into one dedicated Google calendar created by the app, and SHALL only modify events it created (identified by a private extended property).

#### Scenario: Foreign event in blocker calendar
- **WHEN** the blocker calendar contains an event without the cal-block marker
- **THEN** the sync never updates or deletes it

### Requirement: Sync window
The sync window SHALL start at the beginning of the current local day and end after a configurable number of days (default 60). Blockers that end before the window start SHALL NOT be touched.

#### Scenario: Default horizon
- **WHEN** no horizon is configured and today is 2026-11-05
- **THEN** individual blockers are maintained for occurrences starting from 2026-11-05 00:00 up to, but excluding, 2027-01-04 00:00 local time

### Requirement: Anonymous blockers
Each busy occurrence inside the window SHALL be mirrored as one blocker with the configured title (default `Busy`), the same start and end, all-day if the source is all-day, opaque (busy), private visibility, no description, no location, no attendees, no reminders.

#### Scenario: Timed occurrence
- **WHEN** a source has a busy occurrence 2026-11-10 14:00–15:30 Europe/Berlin
- **THEN** the blocker calendar contains a blocker "Busy" 2026-11-10 14:00–15:30 Europe/Berlin

#### Scenario: All-day occurrence
- **WHEN** a source has a busy all-day occurrence on 2026-11-12
- **THEN** the blocker calendar contains an all-day blocker on 2026-11-12

### Requirement: Reconciliation
Each run SHALL make the set of blockers equal to the set of busy occurrences: create missing blockers, update blockers whose time changed, delete blockers whose occurrence is gone or no longer busy. Identity is derived from source id, event UID and recurrence id; a content hash detects changes. Re-running without source changes SHALL perform no writes.

#### Scenario: Occurrence moved
- **WHEN** a source occurrence moves from 10:00 to 11:00
- **THEN** the existing blocker is updated to 11:00 and no new blocker is created

#### Scenario: Occurrence cancelled or set to free
- **WHEN** a previously busy occurrence becomes cancelled, free or declined
- **THEN** its blocker is deleted

#### Scenario: Idempotent run
- **WHEN** a sync runs twice with unchanged sources
- **THEN** the second run makes no write calls to Google

#### Scenario: Source removed
- **WHEN** a source is removed from the configuration
- **THEN** all blockers of that source are deleted on the next run

### Requirement: Beyond-horizon block
The system SHALL maintain exactly one all-day blocker that repeats daily without end, starting on the first day after the window end. Each run SHALL move its start when the window end has moved.

#### Scenario: Horizon block start
- **WHEN** today is 2026-11-05 and the horizon is 60 days
- **THEN** the beyond-horizon block is an all-day daily recurring blocker starting 2027-01-04

#### Scenario: Next day
- **WHEN** the next run happens on 2026-11-06
- **THEN** the beyond-horizon block starts 2027-01-05 and the 2027-01-04 day is covered by individual blockers only

### Requirement: Dry run
The sync CLI SHALL support `--dry-run`, which reads everything and prints the planned creates, updates and deletes without writing.

#### Scenario: Dry run
- **WHEN** the CLI runs with `--dry-run`
- **THEN** it prints the planned changes and makes no write calls to Google
