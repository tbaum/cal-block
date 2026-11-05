import type { calendar_v3 } from "@googleapis/calendar";
import type { GoogleEventsApi } from "./google.ts";

export const notFound = () => Object.assign(new Error("Not Found"), { status: 404 });

export function fakeEvents(pageSize = 2) {
  const writes: string[] = [];
  const events = new Map<string, calendar_v3.Schema$Event>();
  const listCalls: calendar_v3.Params$Resource$Events$List[] = [];
  let nextId = 1;
  const matches = (event: calendar_v3.Schema$Event, params: calendar_v3.Params$Resource$Events$List) => {
    const wanted = (params.privateExtendedProperty as string[] | undefined) ?? [];
    const props = event.extendedProperties?.private ?? {};
    const end = event.end?.dateTime ?? event.end?.date ?? "";
    return wanted.every((pair) => props[pair.split("=")[0] ?? ""] === pair.split("=")[1]) && (!params.timeMin || end > params.timeMin);
  };
  const api: GoogleEventsApi = {
    list: async (params) => {
      listCalls.push(params);
      const all = [...events.values()].filter((event) => matches(event, params));
      const offset = Number(params.pageToken ?? 0);
      const items = all.slice(offset, offset + pageSize);
      return { data: { items, ...(offset + pageSize < all.length && { nextPageToken: String(offset + pageSize) }) } };
    },
    insert: async ({ requestBody }) => {
      const id = `ev${nextId++}`;
      writes.push(`insert ${id}`);
      events.set(id, { ...requestBody, id });
      return {};
    },
    update: async ({ eventId, requestBody }) => {
      if (!eventId || !events.has(eventId)) throw notFound();
      writes.push(`update ${eventId}`);
      events.set(eventId, { ...requestBody, id: eventId });
      return {};
    },
    delete: async ({ eventId }) => {
      if (!eventId || !events.delete(eventId)) throw notFound();
      writes.push(`delete ${eventId}`);
      return {};
    },
  };
  return { api, events, listCalls, writes };
}

