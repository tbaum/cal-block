import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";

function createSettingsWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 720,
    height: 560,
    title: "cal-block",
    webPreferences: {
      preload: join(import.meta.dirname, "../preload/index.cjs"),
      contextIsolation: true,
      sandbox: true,
    },
  });
  if (process.env["ELECTRON_RENDERER_URL"]) {
    void window.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    void window.loadFile(join(import.meta.dirname, "../renderer/index.html"));
  }
  return window;
}

ipcMain.handle("app:version", () => app.getVersion());

void app.whenReady().then(createSettingsWindow);
app.on("window-all-closed", () => app.quit());
