# calendar-sources Specification

## Purpose
TBD - created by archiving change add-cal-block. Update Purpose after archive.
## Requirements
### Requirement: ICS URL source
The system SHALL support sources of type `ics` defined by a name and an HTTP(S) URL. The URL MUST be stored in the macOS Keychain, not in the config file, because secret iCal addresses grant read access.

#### Scenario: Fetch an ICS source
- **WHEN** a sync runs and an enabled `ics` source exists
- **THEN** the system fetches the URL and parses all VEVENT components

#### Scenario: webcal scheme
- **WHEN** the configured URL starts with `webcal://`
- **THEN** the system fetches it as `https://`

### Requirement: iCloud CalDAV source
The system SHALL support sources of type `icloud` defined by a name, an Apple ID and a set of selected calendars. The app-specific password MUST be stored in the macOS Keychain. The system SHALL only request events in the sync window from the server.

#### Scenario: Discover calendars
- **WHEN** the user enters Apple ID and app-specific password in the app
- **THEN** the app lists the iCloud calendars that contain events and lets the user select one or more

#### Scenario: Fetch selected calendars
- **WHEN** a sync runs and an enabled `icloud` source exists
- **THEN** the system fetches the events of each selected calendar within the sync window

### Requirement: Recurrence expansion
The system SHALL expand recurring events into individual occurrences within the sync window, honouring RRULE, RDATE, EXDATE, overridden instances (RECURRENCE-ID) and time zones.

#### Scenario: Weekly series with one moved instance
- **WHEN** a source has a weekly series and one instance was moved to another time
- **THEN** the occurrences contain the moved instance at its new time and not at the original time

#### Scenario: Excluded date
- **WHEN** a series has an EXDATE inside the window
- **THEN** no occurrence is produced for that date

### Requirement: Busy filter
The system SHALL treat an occurrence as busy unless it is cancelled, marked free, or declined by the owner.

#### Scenario: Cancelled event
- **WHEN** an occurrence has `STATUS:CANCELLED`
- **THEN** it produces no busy occurrence

#### Scenario: Free event
- **WHEN** an occurrence has `TRANSP:TRANSPARENT`
- **THEN** it produces no busy occurrence

#### Scenario: Declined invitation
- **WHEN** the source has owner email addresses configured and the occurrence has an ATTENDEE with one of those addresses and `PARTSTAT=DECLINED`
- **THEN** it produces no busy occurrence

### Requirement: Source failure isolation
A failing source SHALL NOT cause blockers of that source to be deleted, and SHALL NOT stop other sources from syncing.

#### Scenario: Source unreachable
- **WHEN** fetching or parsing one source fails
- **THEN** the existing blockers of that source stay untouched, other sources sync normally, and the failure is recorded in the run status

