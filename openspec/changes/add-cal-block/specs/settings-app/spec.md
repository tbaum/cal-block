## ADDED Requirements

### Requirement: Menu bar presence
The app SHALL run as a menu bar app only: no Dock icon, no window at start. The menu bar icon SHALL show an error state when the last run failed. The menu SHALL contain: last run time and outcome (with up to three error lines), "Jetzt synchronisieren", "Einstellungen…", "Beenden".

#### Scenario: Start
- **WHEN** the app starts
- **THEN** only the menu bar icon appears, no Dock icon and no window

#### Scenario: Last run failed
- **WHEN** the last run ended with outcome `failed` or `partial`
- **THEN** the menu bar icon shows the error state and the menu shows the error summary

#### Scenario: Open settings
- **WHEN** the user chooses "Einstellungen…"
- **THEN** the settings window opens; closing it leaves the app running in the menu bar

### Requirement: Google connection
The app SHALL connect a Google account through OAuth with a user-provided Desktop OAuth client, using a loopback redirect, and store the refresh token in the Keychain. On first connection it SHALL create the blocker calendar.

#### Scenario: Connect Google
- **WHEN** the user enters client id and secret and clicks "Connect Google"
- **THEN** the system browser opens the consent page, and after consent the app shows the connected account and the blocker calendar

#### Scenario: Disconnect
- **WHEN** the user clicks "Disconnect"
- **THEN** the refresh token is removed from the Keychain and periodic runs stop writing until reconnected

### Requirement: Source management
The app SHALL let the user add, edit, enable/disable and remove sources of type `ics` and `icloud`, including optional owner email addresses for declined detection.

#### Scenario: Add ICS source
- **WHEN** the user adds a source with name and URL
- **THEN** the source appears in the list and the URL is stored in the Keychain

#### Scenario: Test source
- **WHEN** the user clicks "Test" on a source
- **THEN** the app shows the number of busy occurrences in the window or the error

### Requirement: Sync settings
The app SHALL let the user set the horizon in days, the blocker title, the sync interval and "start at login".

#### Scenario: Change horizon
- **WHEN** the user sets the horizon to 90 days
- **THEN** the next run maintains individual blockers for 90 days and starts the beyond-horizon block on day 91

### Requirement: Status and manual run in the menu
Status and "Jetzt synchronisieren" SHALL live in the menu bar menu only; the settings window holds settings only (Google connection, sources, sync options).

#### Scenario: Sync now
- **WHEN** the user chooses "Jetzt synchronisieren" in the menu
- **THEN** a run starts in the app, the menu shows "Synchronisiere …", and the menu refreshes when it finishes
