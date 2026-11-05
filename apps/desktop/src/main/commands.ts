import type { AppState, CalBlockCommands } from "../shared/api.ts";
import type { AppService } from "./app-service.ts";
import type { SyncScheduler } from "./scheduler.ts";

export function appCommands(service: AppService, scheduler: SyncScheduler): CalBlockCommands & { state(): Promise<AppState> } {
  const state = async (): Promise<AppState> => ({ ...(await service.state()), schedule: scheduler.info() });
  const thenState = <A extends unknown[]>(action: (...args: A) => Promise<unknown>) => async (...args: A) => {
    await action(...args);
    return state();
  };
  return {
    state,
    getState: state,
    saveSettings: thenState(service.saveSettings),
    saveSource: thenState(service.saveSource),
    removeSource: thenState(service.removeSource),
    testSource: service.testSource,
    discoverIcloudCalendars: service.discoverIcloudCalendars,
    connectGoogle: thenState(service.connectGoogle),
    disconnectGoogle: thenState(service.disconnectGoogle),
    syncNow: thenState(() => scheduler.runNow()),
  };
}
