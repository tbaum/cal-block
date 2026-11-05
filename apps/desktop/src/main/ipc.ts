import { ipcMain } from "electron";
import { COMMAND_NAMES, commandChannel, type CalBlockCommands } from "../shared/api.ts";

export function registerCommands(commands: CalBlockCommands): void {
  for (const name of COMMAND_NAMES) {
    const command = commands[name] as (...args: unknown[]) => Promise<unknown>;
    ipcMain.handle(commandChannel(name), (_event, ...args: unknown[]) => command(...args));
  }
}
