import { join } from "node:path";
import { BrowserWindow } from "electron";

export interface SettingsWindow {
  show(): void;
  send(channel: string, payload: unknown): void;
}

export function settingsWindow(): SettingsWindow {
  let window: BrowserWindow | undefined;
  const create = () => {
    const created = new BrowserWindow({
      width: 760,
      height: 760,
      title: "cal-block",
      show: false,
      webPreferences: { preload: join(import.meta.dirname, "../preload/index.cjs"), contextIsolation: true, sandbox: true },
    });
    created.once("ready-to-show", () => created.show());
    created.on("closed", () => (window = undefined));
    void loadRenderer(created);
    return created;
  };
  return {
    show() {
      window ??= create();
      window.show();
      window.focus();
    },
    send(channel, payload) {
      window?.webContents.send(channel, payload);
    },
  };
}

function loadRenderer(window: BrowserWindow): Promise<void> {
  const devServer = process.env["ELECTRON_RENDERER_URL"];
  return devServer ? window.loadURL(devServer) : window.loadFile(join(import.meta.dirname, "../renderer/index.html"));
}
