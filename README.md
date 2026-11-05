# cal-block

Menüleisten-App für macOS. Sie spiegelt belegte Zeiten aus mehreren Kalenderquellen (ICS-URLs, iCloud) als anonyme „Busy“-Blocker in einen eigenen Google-Kalender „Blocker“ und hält ihn aktuell. Abgesagte, als frei markierte oder abgelehnte Termine geben die Zeit wieder frei. Alles jenseits des Horizonts (Standard 60 Tage) wird durch einen täglichen Ganztags-Blocker belegt.

## Installation

```bash
pnpm install
pnpm package:mac
```

Ergebnis: `apps/desktop/release/cal-block-0.0.0-arm64.dmg` (Apple Silicon). DMG öffnen, `cal-block` nach **Programme** ziehen, starten. Die App erscheint nur als Symbol in der Menüleiste (kein Dock-Symbol, kein Fenster).

- Die App ist nur ad-hoc signiert (keine Apple-Developer-ID, keine Notarisierung). Lokal gebaut startet sie ohne Rückfrage; eine kopierte oder heruntergeladene App beim ersten Start per Rechtsklick → **Öffnen** freigeben.
- **Beim Anmelden starten** in den Einstellungen trägt die App als Anmeldeobjekt ein (nur in der installierten App, nicht im Entwicklungsmodus).
- Nach einem Update fragt der Schlüsselbund einmal erneut nach dem Zugriff → **Immer erlauben**.
- Vor dem ersten Start der installierten App eine laufende Entwicklungsinstanz (`pnpm dev:desktop`) beenden, sonst synchronisieren zwei Apps.

## Google einrichten

cal-block spricht mit deinem eigenen Google-Cloud-OAuth-Client. Das richtest du einmalig in der Google Cloud Console ein.

### 1. Projekt anlegen und Calendar API aktivieren

1. <https://console.cloud.google.com/> öffnen und mit dem Google-Konto anmelden, dessen Kalender die Blocker bekommen soll.
2. Oben in der Projektauswahl **Neues Projekt** anlegen, z. B. `cal-block`.
3. **APIs & Dienste → Bibliothek** → „Google Calendar API“ suchen → **Aktivieren**.

### 2. OAuth-Zustimmungsbildschirm (Google Auth Platform)

1. **APIs & Dienste → OAuth-Zustimmungsbildschirm** (bzw. **Google Auth Platform**) → **Jetzt starten**.
2. App-Name `cal-block`, Support-E-Mail: deine Adresse.
3. **Zielgruppe:**
   - **Intern**, wenn das Konto zu einem Google-Workspace gehört. Das ist die beste Wahl: kein Prüfhinweis, kein Ablauf des Logins.
   - Sonst **Extern**. Unter **Zielgruppe → Testnutzer** die eigene Google-Adresse eintragen.
4. **Datenzugriff → Bereiche hinzufügen**: `https://www.googleapis.com/auth/calendar.app.created`
   („Sekundäre Kalender ansehen, erstellen, ändern und löschen, die diese App erstellt hat“). cal-block sieht damit **nur** den Kalender, den es selbst anlegt, nicht deine übrigen Kalender.

> **Wichtig bei „Extern“:** Solange die App im Status **Test** ist, läuft der Google-Login nach **7 Tagen** ab. Danach zeigt das Menü einen Fehler und du musst dich neu verbinden. Abhilfe: unter **Zielgruppe** auf **App veröffentlichen** (Status „In Produktion“) stellen. Eine Prüfung durch Google ist für die eigene Nutzung nicht nötig, beim Verbinden erscheint dann nur der Hinweis „Google hat diese App nicht überprüft“ (siehe Schritt 4).

### 3. Desktop-Client anlegen

1. **Clients** (bzw. **APIs & Dienste → Anmeldedaten**) → **Client erstellen** / **Anmeldedaten erstellen → OAuth-Client-ID**.
2. Anwendungstyp **Desktop-App**, Name z. B. `cal-block mac`.
3. **Client-ID** und **Clientschlüssel (Client-Secret)** kopieren. Eine Weiterleitungs-URI musst du nicht eintragen, denn Desktop-Clients erlauben automatisch die lokale Rücksprungadresse `http://127.0.0.1:<port>`, die cal-block verwendet.

### 4. In cal-block verbinden

1. Menüleisten-Symbol → **Einstellungen…** → Abschnitt **Google**.
2. Client-ID und Client-Secret eintragen → **Mit Google verbinden**.
3. Der Browser öffnet sich: Konto wählen. Bei einer nicht überprüften App erscheint „Google hat diese App nicht überprüft“ → **Erweitert → Weiter zu cal-block (unsicher)**. Das ist deine eigene App.
4. Zugriff erlauben. Der Browser zeigt „cal-block ist mit Google verbunden“, das Fenster kann zu.
5. cal-block legt den Kalender **Blocker** an und synchronisiert ab jetzt im eingestellten Intervall.

Der Client-Secret und das Login-Token liegen im macOS-Schlüsselbund (Dienst `cal-block`). Beim ersten Zugriff fragt macOS nach. **Immer erlauben** wählen, nach einem App-Update kommt die Frage einmal erneut.

**Trennen** in den Einstellungen löscht das Login-Token. Der Kalender „Blocker“ bleibt bestehen und wird beim erneuten Verbinden wiederverwendet.

### 5. Blocker für andere sichtbar machen

Der Kalender „Blocker“ ist ein eigener (sekundärer) Kalender. Je nachdem, wer deine Verfügbarkeit liest:

- **Google-Terminbuchungsseiten:** In der Terminplanung unter **Gebuchte Termine → Verfügbarkeit anhand dieser Kalender prüfen** den Kalender „Blocker“ hinzufügen.
- **Externe Buchungstools** (Calendly, cal.com, …): dort den Kalender „Blocker“ zur Konfliktprüfung auswählen.
- **Kollegen:** den Kalender „Blocker“ in Google Kalender über **Einstellungen und Freigabe** freigeben, mindestens mit „Nur Verfügbarkeit (frei/belegt) anzeigen“.

## iCloud-Kalender als Quelle

1. <https://account.apple.com/> → **Anmeldung und Sicherheit → App-spezifische Passwörter** → neues Passwort `cal-block` erzeugen.
2. In cal-block: **Einstellungen… → Quelle hinzufügen → iCloud-Kalender**, Apple-ID und App-Passwort eintragen → **Kalender laden** → Kalender auswählen → **Speichern**.

## Google- oder andere ICS-Kalender als Quelle

- Google: Kalender-Einstellungen → **Kalender integrieren → Geheime Adresse im iCal-Format** kopieren.
- In cal-block: **Quelle hinzufügen → ICS-URL**. Die URL wird im Schlüsselbund gespeichert, nicht in der Konfiguration.
- Optional die eigenen E-Mail-Adressen eintragen: Einladungen, die du abgelehnt hast, blockieren dann nicht.

Google aktualisiert diese iCal-Adressen mit einigen Stunden Verzögerung.

## Entwicklung

```bash
pnpm install      # lädt auch das Electron-Binary
pnpm build        # alle Pakete
pnpm test         # Vitest
pnpm dev:desktop  # Menüleisten-App im Entwicklungsmodus
pnpm package:mac  # .app + .dmg nach apps/desktop/release/
node apps/sync/dist/sync.cjs --dry-run   # einmaliger Lauf ohne Schreiben, zeigt den Plan
```

Dateien:

| Was | Wo |
|---|---|
| Konfiguration | `~/Library/Application Support/cal-block/config.json` |
| Status des letzten Laufs | `~/Library/Application Support/cal-block/status.json` |
| Log | `~/Library/Logs/cal-block/sync.log` |
| Geheimnisse | macOS-Schlüsselbund, Dienst `cal-block` |

Spezifikation: `openspec/specs/`, Design und Entscheidungen: `openspec/changes/archive/2026-11-05-add-cal-block/`.
