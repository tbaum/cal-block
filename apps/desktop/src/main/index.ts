import { homedir } from "node:os";
import { join } from "node:path";
import { app, powerMonitor, shell } from "electron";
import { appPaths, keychainSecretStore } from "@cal-block/core";
import { STATE_CHANNEL } from "../shared/api.ts";
import { createAppService, type LoginItem } from "./app-service.ts";
import { appCommands } from "./commands.ts";
import { registerCommands } from "./ipc.ts";
import { SyncScheduler } from "./scheduler.ts";
import { settingsWindow } from "./settings-window.ts";
import { createStatusTray } from "./tray.ts";

const loginItem: LoginItem = {
  setEnabled: (enabled) => {
    if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: enabled });
  },
};

function resourcesDir(): string {
  return app.isPackaged ? process.resourcesPath : join(import.meta.dirname, "../../resources");
}

async function startMenuBarApp(): Promise<void> {
  app.dock?.hide();
  const service = createAppService({
    paths: appPaths(homedir()),
    secrets: keychainSecretStore(),
    openBrowser: (url) => shell.openExternal(url),
    loginItem,
  });
  const window = settingsWindow();
  let pushState = () => {};
  const scheduler = new SyncScheduler({
    run: () => service.sync(),
    intervalMs: () => service.intervalMs(),
    lastRunAt: () => service.lastRunAt(),
    onChange: () => pushState(),
    onError: (error) => console.error("sync failed", error),
  });
  const commands = appCommands(service, scheduler);
  const tray = createStatusTray(resourcesDir(), (action) => {
    if (action === "syncNow") void scheduler.runNow();
    if (action === "openSettings") window.show();
    if (action === "quit") app.quit();
  });
  pushState = () =>
    void commands.state().then((state) => {
      tray.update(state);
      window.send(STATE_CHANNEL, state);
    });

  registerCommands(commands);
  service.onChange(() => {
    pushState();
    void scheduler.rearm();
  });
  powerMonitor.on("resume", () => void scheduler.onWake());
  app.on("second-instance", () => window.show());
  await service.applyLoginItem();
  pushState();
  void scheduler.start();
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("window-all-closed", () => {});
  void app.whenReady().then(startMenuBarApp);
}
