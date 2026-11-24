import { randomBytes } from "node:crypto";
import { z } from "zod";

/** Mot de passe jetable, différent à chaque lancement des tests. */
const generated = () => `t-${randomBytes(12).toString("base64url")}`;

const schema = z.object({
  TEST_ADMIN_EMAIL: z.string().email().default("admin@example.test"),
  TEST_ADMIN_PASSWORD: z.string().min(12).default(generated),
  TEST_WRONG_PASSWORD: z.string().min(12).default(generated),
  TEST_NEW_PASSWORD: z.string().min(12).default(generated),
});

const parsed = schema.parse(process.env);

// Réécrit dans process.env : les workers Playwright et le serveur de test
// héritent ainsi des mêmes identifiants que le processus qui les lance.
Object.assign(process.env, parsed);

export const testEnv = {
  admin: {
    email: parsed.TEST_ADMIN_EMAIL,
    password: parsed.TEST_ADMIN_PASSWORD,
  },
  wrongPassword: parsed.TEST_WRONG_PASSWORD,
  newPassword: parsed.TEST_NEW_PASSWORD,
};
