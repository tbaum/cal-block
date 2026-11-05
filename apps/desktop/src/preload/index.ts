import { contextBridge, ipcRenderer } from "electron";

const calBlockApi = {
  version: (): Promise<string> => ipcRenderer.invoke("app:version"),
};

export type CalBlockApi = typeof calBlockApi;

contextBridge.exposeInMainWorld("calBlock", calBlockApi);
