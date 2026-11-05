import { join } from "node:path";
import { Menu, nativeImage, Tray, type MenuItemConstructorOptions } from "electron";
import type { AppState } from "../shared/api.ts";
import { trayIcon, trayMenu, type TrayAction, type TrayEntry, type TrayIcon } from "./tray-menu.ts";

const ICON_FILES: Record<TrayIcon, string> = { normal: "trayTemplate.png", error: "trayErrorTemplate.png" };

export interface StatusTray {
  update(state: AppState): void;
}

export function createStatusTray(resourcesDir: string, onAction: (action: TrayAction) => void): StatusTray {
  const icons = loadIcons(resourcesDir);
  const tray = new Tray(icons.normal);
  tray.setToolTip("cal-block");
  return {
    update(state) {
      tray.setImage(icons[trayIcon(state)]);
      tray.setContextMenu(Menu.buildFromTemplate(trayMenu(state, new Date()).map((entry) => menuItem(entry, onAction))));
    },
  };
}

function loadIcons(resourcesDir: string): Record<TrayIcon, Electron.NativeImage> {
  const load = (file: string) => {
    const image = nativeImage.createFromPath(join(resourcesDir, file));
    image.setTemplateImage(true);
    return image;
  };
  return { normal: load(ICON_FILES.normal), error: load(ICON_FILES.error) };
}

function menuItem(entry: TrayEntry, onAction: (action: TrayAction) => void): MenuItemConstructorOptions {
  switch (entry.kind) {
    case "separator":
      return { type: "separator" };
    case "info":
      return { label: entry.label, enabled: false };
    case "action":
      return { label: entry.label, enabled: entry.enabled, click: () => onAction(entry.action) };
  }
}
