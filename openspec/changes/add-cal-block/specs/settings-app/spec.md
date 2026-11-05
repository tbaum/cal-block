## ADDED Requirements

### Requirement: Google connection
The app SHALL connect a Google account through OAuth with a user-provided Desktop OAuth client, using a loopback redirect, and store the refresh token in the Keychain. On first connection it SHALL create the blocker calendar.

#### Scenario: Connect Google
- **WHEN** the user enters client id and secret and clicks "Connect Google"
- **THEN** the system browser opens the consent page, and after consent the app shows the connected account and the blocker calendar

#### Scenario: Disconnect
- **WHEN** the user clicks "Disconnect"
- **THEN** the refresh token is removed from the Keychain and the schedule stops writing

### Requirement: Source management
The app SHALL let the user add, edit, enable/disable and remove sources of type `ics` and `icloud`, including optional owner email addresses for declined detection.

#### Scenario: Add ICS source
- **WHEN** the user adds a source with name and URL
- **THEN** the source appears in the list and the URL is stored in the Keychain

#### Scenario: Test source
- **WHEN** the user clicks "Test" on a source
- **THEN** the app shows the number of busy occurrences in the window or the error

### Requirement: Sync settings
The app SHALL let the user set the horizon in days, the blocker title, the schedule interval and enable/disable the schedule.

#### Scenario: Change horizon
- **WHEN** the user sets the horizon to 90 days
- **THEN** the next run maintains individual blockers for 90 days and starts the beyond-horizon block on day 91

### Requirement: Status and manual run
The app SHALL show the last run's time, outcome, change counts and per-source errors, and SHALL offer "Sync now", which runs the same sync CLI.

#### Scenario: Sync now
- **WHEN** the user clicks "Sync now"
- **THEN** the sync CLI runs and the status view refreshes when it finishes
