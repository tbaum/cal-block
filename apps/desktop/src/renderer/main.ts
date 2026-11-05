import type { CalendarSummary, Source } from "@cal-block/core";
import type { AppState, CalBlockApi, SourceDraft } from "../shared/api.ts";
import { h, inputValue, isChecked, readableError, replaceContent } from "./dom.ts";

declare global {
  interface Window {
    calBlock: CalBlockApi;
  }
}

const api = window.calBlock;
const sections = {
  google: document.querySelector("#google")!,
  sources: document.querySelector("#sources")!,
  settings: document.querySelector("#settings")!,
};

let state: AppState;
let editing: { source?: Source; calendars: CalendarSummary[] } | undefined;

async function act(feedback: Element, action: () => Promise<AppState | void>, done?: string): Promise<void> {
  replaceContent(feedback, h("span", { class: "muted" }, "…"));
  try {
    const next = await action();
    if (next) render(next);
    replaceContent(feedback, done ? h("span", { class: "ok" }, done) : "");
  } catch (error) {
    replaceContent(feedback, h("span", { class: "error" }, readableError(error)));
  }
}

function render(next: AppState, { settings = false } = {}): void {
  state = next;
  renderGoogle();
  if (!editing) renderSources();
  if (settings) renderSettings();
}

function renderGoogle(): void {
  const { google } = state;
  const feedback = h("span");
  if (google.connected) {
    replaceContent(
      sections.google,
      h("h2", {}, "Google"),
      h("p", {}, h("span", { class: "ok" }, "Verbunden"), h("span", { class: "muted" }, ` · Blocker-Kalender ${google.calendarId ?? ""}`)),
      h("div", { class: "row" }, h("button", { onclick: () => act(feedback, () => api.disconnectGoogle()) }, "Trennen"), feedback),
    );
    return;
  }
  const form = h(
    "div",
    {},
    h("label", {}, "OAuth-Client-ID (Typ „Desktop-App“)"),
    h("input", { type: "text", id: "client-id", value: google.clientId ?? "" }),
    h("label", {}, "Client-Secret"),
    h("input", { type: "password", id: "client-secret", placeholder: google.clientId ? "unverändert lassen" : "" }),
  );
  replaceContent(
    sections.google,
    h("h2", {}, "Google"),
    h("p", { class: "muted" }, "Nicht verbunden. Beim Verbinden öffnet sich der Browser; cal-block legt einen eigenen Kalender „Blocker“ an."),
    form,
    h(
      "div",
      { class: "row" },
      h(
        "button",
        {
          class: "primary",
          onclick: () =>
            act(feedback, () => api.connectGoogle({ clientId: inputValue(form, "#client-id"), clientSecret: inputValue(form, "#client-secret") }), "Verbunden"),
        },
        "Mit Google verbinden",
      ),
      feedback,
    ),
  );
}

function renderSources(): void {
  const rows = state.config.sources.map((source) => {
    const feedback = h("span", { class: "muted" });
    return h(
      "div",
      { class: "source" },
      h("span", { class: "name" }, source.name, h("span", { class: "muted" }, ` · ${source.kind === "ics" ? "ICS" : "iCloud"}${source.enabled ? "" : " · deaktiviert"}`)),
      feedback,
      h("button", { onclick: () => testExisting(source, feedback) }, "Testen"),
      h("button", { onclick: () => openEditor(source) }, "Bearbeiten"),
      h("button", { onclick: () => confirm(`Quelle „${source.name}“ entfernen? Ihre Blocker werden beim nächsten Lauf gelöscht.`) && act(feedback, () => api.removeSource(source.id)) }, "Entfernen"),
    );
  });
  replaceContent(
    sections.sources,
    h("h2", {}, "Quellen"),
    ...(rows.length > 0 ? rows : [h("p", { class: "muted" }, "Noch keine Quelle.")]),
    h("div", { class: "row" }, h("button", { onclick: () => openEditor() }, "Quelle hinzufügen")),
  );
}

async function testExisting(source: Source, feedback: Element): Promise<void> {
  replaceContent(feedback, "…");
  const result = await api.testSource(draftOf(source));
  replaceContent(feedback, result.ok ? h("span", { class: "ok" }, `${result.busyOccurrences} belegt`) : h("span", { class: "error" }, result.error));
}

function draftOf(source: Source): SourceDraft {
  return source.kind === "ics"
    ? { id: source.id, kind: "ics", name: source.name, enabled: source.enabled, ownerEmails: source.ownerEmails }
    : { id: source.id, kind: "icloud", name: source.name, enabled: source.enabled, ownerEmails: source.ownerEmails, appleId: source.appleId, calendarUrls: source.calendarUrls };
}

function openEditor(source?: Source): void {
  editing = { ...(source && { source }), calendars: [] };
  renderEditor();
}

function closeEditor(): void {
  editing = undefined;
  renderSources();
}

function renderEditor(): void {
  const source = editing?.source;
  const kindSelect = h(
    "select",
    { id: "kind", disabled: Boolean(source), onchange: () => renderEditorFields(fields, kindSelect.value as SourceDraft["kind"]) },
    h("option", { value: "ics" }, "ICS-URL (z. B. Google „Geheime Adresse im iCal-Format“)"),
    h("option", { value: "icloud" }, "iCloud-Kalender (CalDAV)"),
  );
  kindSelect.value = source?.kind ?? "ics";
  const fields = h("div");
  const feedback = h("span");
  const form = h(
    "div",
    {},
    h("label", {}, "Art"),
    kindSelect,
    h("label", {}, "Name"),
    h("input", { type: "text", id: "name", value: source?.name ?? "" }),
    fields,
    h("label", {}, "Eigene E-Mail-Adressen (abgelehnte Einladungen geben frei), kommagetrennt"),
    h("input", { type: "text", id: "owner-emails", value: source?.ownerEmails.join(", ") ?? "" }),
    h("label", { class: "inline" }, h("input", { type: "checkbox", id: "enabled", checked: source?.enabled ?? true }), "aktiv"),
  );
  renderEditorFields(fields, kindSelect.value as SourceDraft["kind"]);
  replaceContent(
    sections.sources,
    h("h2", {}, source ? `Quelle „${source.name}“ bearbeiten` : "Quelle hinzufügen"),
    form,
    h(
      "div",
      { class: "row" },
      h("button", { class: "primary", onclick: () => act(feedback, async () => { const next = await api.saveSource(editorDraft(form)); editing = undefined; return next; }) }, "Speichern"),
      h("button", { onclick: async () => { replaceContent(feedback, "…"); const result = await api.testSource(editorDraft(form)); replaceContent(feedback, result.ok ? h("span", { class: "ok" }, `${result.busyOccurrences} belegte Termine im Zeitraum`) : h("span", { class: "error" }, result.error)); } }, "Testen"),
      h("button", { onclick: closeEditor }, "Abbrechen"),
      feedback,
    ),
  );
}

function renderEditorFields(container: Element, kind: SourceDraft["kind"]): void {
  const source = editing?.source;
  const keepHint = source ? "unverändert lassen" : "";
  if (kind === "ics") {
    replaceContent(container, h("label", {}, "ICS-URL (wird im Schlüsselbund gespeichert)"), h("input", { type: "password", id: "secret", placeholder: keepHint }));
    return;
  }
  const calendarList = h("div");
  const feedback = h("span");
  const selected = new Set(source?.kind === "icloud" ? source.calendarUrls : []);
  const showCalendars = (calendars: CalendarSummary[]) =>
    replaceContent(
      calendarList,
      ...calendars.map((calendar) =>
        h("label", { class: "inline" }, h("input", { type: "checkbox", class: "calendar", value: calendar.url, checked: selected.has(calendar.url) }), calendar.name),
      ),
    );
  replaceContent(
    container,
    h("label", {}, "Apple-ID"),
    h("input", { type: "text", id: "apple-id", value: source?.kind === "icloud" ? source.appleId : "" }),
    h("label", {}, "App-spezifisches Passwort (appleid.apple.com → Anmeldung und Sicherheit)"),
    h("input", { type: "password", id: "secret", placeholder: keepHint }),
    h(
      "div",
      { class: "row" },
      h(
        "button",
        {
          onclick: () =>
            act(feedback, async () => {
              if (!editing) return;
              editing.calendars = await api.discoverIcloudCalendars({
                appleId: inputValue(container, "#apple-id"),
                password: inputValue(container, "#secret"),
                ...(source && { sourceId: source.id }),
              });
              showCalendars(editing.calendars);
            }),
        },
        "Kalender laden",
      ),
      feedback,
    ),
    calendarList,
  );
  if (source?.kind === "icloud") showCalendars(source.calendarUrls.map((url) => ({ url, name: url })));
}

function editorDraft(form: HTMLElement): SourceDraft {
  const kind = inputValue(form, "#kind") as SourceDraft["kind"];
  const secret = inputValue(form, "#secret");
  const base = {
    ...(editing?.source && { id: editing.source.id }),
    kind,
    name: inputValue(form, "#name"),
    enabled: isChecked(form, "#enabled"),
    ownerEmails: inputValue(form, "#owner-emails").split(",").map((email) => email.trim()).filter(Boolean),
    ...(secret && { secret }),
  };
  if (kind === "ics") return base;
  const calendarUrls = [...form.querySelectorAll<HTMLInputElement>("input.calendar:checked")].map((input) => input.value);
  return { ...base, appleId: inputValue(form, "#apple-id"), calendarUrls };
}

function renderSettings(): void {
  const { config } = state;
  const feedback = h("span");
  const form = h(
    "div",
    { class: "grid" },
    h("div", {}, h("label", {}, "Horizont (Tage, danach alles blockiert)"), h("input", { type: "number", id: "horizon", min: 1, max: 730, value: config.horizonDays })),
    h("div", {}, h("label", {}, "Sync-Intervall (Minuten)"), h("input", { type: "number", id: "interval", min: 5, max: 1440, value: config.syncIntervalMinutes })),
    h("div", {}, h("label", {}, "Titel der Blocker"), h("input", { type: "text", id: "title", value: config.blockerTitle })),
    h("div", {}, h("label", {}, " "), h("label", { class: "inline" }, h("input", { type: "checkbox", id: "login", checked: config.startAtLogin }), "Beim Anmelden starten")),
  );
  replaceContent(
    sections.settings,
    h("h2", {}, "Einstellungen"),
    form,
    h(
      "div",
      { class: "row" },
      h(
        "button",
        {
          class: "primary",
          onclick: () =>
            act(
              feedback,
              () =>
                api.saveSettings({
                  horizonDays: Number(inputValue(form, "#horizon")),
                  syncIntervalMinutes: Number(inputValue(form, "#interval")),
                  blockerTitle: inputValue(form, "#title"),
                  startAtLogin: isChecked(form, "#login"),
                }),
              "Gespeichert",
            ),
        },
        "Speichern",
      ),
      feedback,
    ),
  );
}

api.onStateChanged((next) => render(next));
void api.getState().then((initial) => render(initial, { settings: true }));
