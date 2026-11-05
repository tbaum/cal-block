import type { AppState } from "../shared/api.ts";

export type TrayAction = "syncNow" | "openSettings" | "quit";

export type TrayEntry =
  | { readonly kind: "info"; readonly label: string }
  | { readonly kind: "action"; readonly label: string; readonly action: TrayAction; readonly enabled: boolean }
  | { readonly kind: "separator" };

export type TrayIcon = "normal" | "error";

const MAX_ERROR_LENGTH = 60;

export function trayIcon(state: AppState): TrayIcon {
  return state.status && state.status.outcome !== "ok" ? "error" : "normal";
}

export function trayMenu(state: AppState, now: Date): TrayEntry[] {
  return [
    ...statusEntries(state, now),
    { kind: "separator" },
    { kind: "action", label: "Jetzt synchronisieren", action: "syncNow", enabled: !state.schedule.running && state.google.connected },
    { kind: "action", label: "Einstellungen…", action: "openSettings", enabled: true },
    { kind: "separator" },
    { kind: "action", label: "Beenden", action: "quit", enabled: true },
  ];
}

function statusEntries(state: AppState, now: Date): TrayEntry[] {
  if (state.schedule.running) return [{ kind: "info", label: "Synchronisiere …" }];
  if (!state.google.connected) return [{ kind: "info", label: "Google nicht verbunden" }];
  const { status } = state;
  if (!status) return [{ kind: "info", label: "Noch nicht synchronisiert" }];
  const when = formatWhen(new Date(status.finishedAt), now);
  if (status.outcome === "ok") {
    const { created, updated, deleted } = status.counts;
    return [{ kind: "info", label: `Letzter Sync ${when}: ok (+${created} ~${updated} −${deleted})` }];
  }
  const label = status.outcome === "partial" ? "teilweise fehlgeschlagen" : "fehlgeschlagen";
  return [
    { kind: "info", label: `Letzter Sync ${when}: ${label}` },
    ...status.errors.slice(0, 3).map((error): TrayEntry => ({ kind: "info", label: truncate(error) })),
  ];
}

function formatWhen(time: Date, now: Date): string {
  const clock = time.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return time.toDateString() === now.toDateString() ? clock : `${time.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} ${clock}`;
}

function truncate(text: string): string {
  return text.length > MAX_ERROR_LENGTH ? `${text.slice(0, MAX_ERROR_LENGTH - 1)}…` : text;
}
