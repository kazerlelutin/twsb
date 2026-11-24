import { z } from "zod";
import { db, json } from "./db.server";
import { env } from "./env.server";
import { bumpVersion, siteVersion } from "./repo.server";

/** Réglages modifiables depuis l'admin une fois le site installé. */
export const storedConfigSchema = z.object({
  publicUrl: z
    .string()
    .max(300)
    .refine((v) => !v || /^https?:\/\/[^\s/]+/.test(v), "URL invalide")
    .transform((v) => v.trim().replace(/\/+$/, ""))
    .default(""),
  smtp: z
    .object({
      host: z.string().max(200).default(""),
      port: z.coerce.number().int().min(1).max(65535).default(587),
      secure: z.boolean().default(false),
      user: z.string().max(200).default(""),
      pass: z.string().max(500).default(""),
      from: z.string().max(200).default(""),
    })
    .default({}),
});

export type StoredConfig = z.output<typeof storedConfigSchema>;

export function getStoredConfig(): StoredConfig {
  const row = db().get<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'config'",
  );
  const parsed = storedConfigSchema.safeParse(json(row?.value, {}));
  return parsed.success ? parsed.data : storedConfigSchema.parse({});
}

export function saveStoredConfig(next: StoredConfig) {
  db().run(
    "INSERT INTO settings (key, value) VALUES ('config', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    JSON.stringify(next),
  );
  bumpVersion();
  cached = undefined;
}

export type RuntimeConfig = {
  publicUrl: string;
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    pass?: string;
    from: string;
  };
  /** D'où vient chaque réglage : l'environnement l'emporte toujours. */
  sources: {
    publicUrl: "env" | "admin" | "default";
    smtp: "env" | "admin" | "none";
  };
};

let cached:
  | { version: number; env: ReturnType<typeof env>; value: RuntimeConfig }
  | undefined;

/** Configuration effective : variables d'environnement, sinon réglages de l'admin. */
export function config(): RuntimeConfig {
  const e = env();
  if (cached && cached.version === siteVersion() && cached.env === e)
    return cached.value;
  const stored = getStoredConfig();
  const smtp = e.smtp
    ? e.smtp
    : stored.smtp.host
      ? {
          host: stored.smtp.host,
          port: stored.smtp.port,
          secure: stored.smtp.secure || stored.smtp.port === 465,
          user: stored.smtp.user || undefined,
          pass: stored.smtp.pass || undefined,
          from: stored.smtp.from || `no-reply@${stored.smtp.host}`,
        }
      : undefined;
  const value: RuntimeConfig = {
    publicUrl: e.publicUrlFromEnv
      ? e.publicUrl
      : stored.publicUrl || e.publicUrl,
    smtp,
    sources: {
      publicUrl: e.publicUrlFromEnv
        ? "env"
        : stored.publicUrl
          ? "admin"
          : "default",
      smtp: e.smtp ? "env" : smtp ? "admin" : "none",
    },
  };
  cached = { version: siteVersion(), env: e, value };
  return value;
}
