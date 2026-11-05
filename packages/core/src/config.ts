import { z } from "zod";
import { readJsonIfExists, writeFileAtomic } from "./files.ts";
import { DEFAULT_HORIZON_DAYS } from "./horizon.ts";
import { sourceSchema } from "./sources.ts";

export const configSchema = z.object({
  sources: z
    .array(sourceSchema)
    .default([])
    .refine((sources) => new Set(sources.map((s) => s.id)).size === sources.length, "source ids must be unique"),
  horizonDays: z.int().min(1).max(730).default(DEFAULT_HORIZON_DAYS),
  blockerTitle: z.string().min(1).default("Busy"),
  syncIntervalMinutes: z.int().min(5).max(1440).default(60),
  startAtLogin: z.boolean().default(true),
  google: z
    .object({ clientId: z.string().min(1).optional(), calendarId: z.string().min(1).optional() })
    .default({}),
});

export type Config = z.infer<typeof configSchema>;

export const DEFAULT_CONFIG: Config = configSchema.parse({});

export class ConfigError extends Error {
  constructor(file: string, details: string) {
    super(`invalid config ${file}:\n${details}`);
    this.name = "ConfigError";
  }
}

export async function loadConfig(file: string): Promise<Config> {
  return validConfig(file, (await readJsonIfExists(file)) ?? {});
}

export async function saveConfig(file: string, config: Config): Promise<void> {
  await writeFileAtomic(file, `${JSON.stringify(validConfig(file, config), null, 2)}\n`);
}

function validConfig(file: string, candidate: unknown): Config {
  const result = configSchema.safeParse(candidate);
  if (!result.success) throw new ConfigError(file, z.prettifyError(result.error));
  return result.data;
}

export function activeSources(config: Config) {
  return config.sources.filter((source) => source.enabled);
}
