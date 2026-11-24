import path from "node:path";
import { z } from "zod";

/** Chaîne vide = variable absente (fichiers .env avec des clés non remplies). */
const optional = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

const schema = z
  .object({
    DATA_DIR: optional,
    PUBLIC_URL: optional,
    ADMIN_EMAIL: optional.pipe(z.string().email().optional()),
    ADMIN_PASSWORD: optional,
    SMTP_HOST: optional,
    SMTP_PORT: optional.pipe(z.coerce.number().int().positive().default(587)),
    SMTP_SECURE: optional,
    SMTP_USER: optional,
    SMTP_PASS: optional,
    SMTP_FROM: optional,
  })
  .transform((e) => ({
    dataDir: path.resolve(e.DATA_DIR ?? "data"),
    publicUrl: (e.PUBLIC_URL ?? "http://localhost:3000").replace(/\/$/, ""),
    adminEmail: e.ADMIN_EMAIL,
    adminPassword: e.ADMIN_PASSWORD,
    smtp: e.SMTP_HOST
      ? {
          host: e.SMTP_HOST,
          port: e.SMTP_PORT,
          secure: e.SMTP_SECURE === "true" || e.SMTP_PORT === 465,
          user: e.SMTP_USER,
          pass: e.SMTP_PASS,
          from: e.SMTP_FROM ?? `no-reply@${e.SMTP_HOST}`,
        }
      : undefined,
  }));

export type ServerEnv = z.output<typeof schema>;

/** Lit et valide l'environnement ; une valeur invalide arrête le démarrage avec un message clair. */
export function readEnv(
  source: Record<string, string | undefined> = process.env,
): ServerEnv {
  const result = schema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((i) => `${i.path.join(".")} : ${i.message}`)
      .join(", ");
    throw new Error(`Variables d'environnement invalides : ${problems}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;
export const env = () => {
  cached ??= readEnv();
  return cached;
};
export const resetEnv = () => {
  cached = undefined;
};
