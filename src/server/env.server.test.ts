// @vitest-environment node
import { describe, expect, test } from "vitest";
import { readEnv } from "./env.server";

describe("variables d'environnement", () => {
  test("valeurs par défaut et clés vides ignorées", () => {
    const env = readEnv({ ADMIN_EMAIL: "", SMTP_HOST: "" });
    expect(env.adminEmail).toBeUndefined();
    expect(env.smtp).toBeUndefined();
    expect(env.publicUrl).toBe("http://localhost:3000");
  });

  test("SMTP : port converti, TLS implicite sur 465", () => {
    const env = readEnv({ SMTP_HOST: "smtp.test", SMTP_PORT: "465" });
    expect(env.smtp).toMatchObject({ port: 465, secure: true });
    expect(env.smtp?.from).toBe("no-reply@smtp.test");
  });

  test("une valeur invalide arrête le démarrage avec un message clair", () => {
    expect(() => readEnv({ ADMIN_EMAIL: "pas-un-email" })).toThrow(
      /ADMIN_EMAIL/,
    );
    expect(() => readEnv({ SMTP_PORT: "abc" })).toThrow(/SMTP_PORT/);
  });
});
