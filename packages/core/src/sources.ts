import { z } from "zod";

const sourceBase = {
  id: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  ownerEmails: z.array(z.email()).default([]),
};

export const sourceSchema = z.discriminatedUnion("kind", [
  z.object({ ...sourceBase, kind: z.literal("ics") }),
  z.object({
    ...sourceBase,
    kind: z.literal("icloud"),
    appleId: z.string().min(1),
    calendarUrls: z.array(z.url()).default([]),
  }),
]);

export type Source = z.infer<typeof sourceSchema>;
export type IcsSource = Extract<Source, { kind: "ics" }>;
export type IcloudSource = Extract<Source, { kind: "icloud" }>;
