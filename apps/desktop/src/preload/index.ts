import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import { COMMAND_NAMES, commandChannel, STATE_CHANNEL, type AppState, type CalBlockApi, type CalBlockCommands } from "../shared/api.ts";

const commands = Object.fromEntries(
  COMMAND_NAMES.map((name) => [name, (...args: unknown[]) => ipcRenderer.invoke(commandChannel(name), ...args)]),
) as unknown as CalBlockCommands;

const api: CalBlockApi = {
  ...commands,
  onStateChanged(listener) {
    const forward = (_event: IpcRendererEvent, state: AppState) => listener(state);
    ipcRenderer.on(STATE_CHANNEL, forward);
    return () => ipcRenderer.removeListener(STATE_CHANNEL, forward);
  },
};

contextBridge.exposeInMainWorld("calBlock", api);
