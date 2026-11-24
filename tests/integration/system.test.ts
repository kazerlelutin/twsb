// @vitest-environment node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { login, setup, system } from "~/server/api.server";
import { db } from "~/server/db.server";
import { publicResponse } from "~/server/public.server";
import { sitemap } from "~/server/site.server";
import { readState } from "../../launcher/core.mjs";
import { ADMIN, call, freshSite, sessionFrom } from "./helpers";

let dataDir = "";
let session = "";

beforeEach(async () => {
  ({ dir: dataDir } = freshSite());
  session = sessionFrom((await call(login, { body: ADMIN })).headers);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("première installation", () => {
  test("sans compte : création de l'administrateur et du site, une seule fois", async () => {
    db().run("DELETE FROM users");
    delete process.env.ADMIN_EMAIL;
    const status = await call(setup.status);
    expect(status.data.needed).toBe(true);
    // Le site public envoie vers l'installation tant qu'aucun compte n'existe.
    const before = await publicResponse(new Request("http://site.test/"));
    expect(before?.status).toBe(302);
    expect(before?.headers.get("location")).toBe("/admin/setup");
    const created = await call(setup.create, {
      origin: "http://site.test",
      body: {
        siteName: "Atelier Lumière",
        name: "Camille",
        email: "camille@example.test",
        password: "un-mot-de-passe-solide",
      },
    });
    expect(created.status).toBe(201);
    expect(created.headers.get("set-cookie")).toContain("ws_session=");
    expect((await call(setup.status)).data.needed).toBe(false);
    expect(
      (await publicResponse(new Request("http://site.test/")))?.status,
    ).toBe(200);
    const again = await call(setup.create, {
      origin: "http://site.test",
      body: {
        siteName: "Pirate",
        email: "pirate@example.test",
        password: "un-autre-mot-de-passe",
      },
    });
    expect(again.status).toBe(409);
  });
});

describe("configuration après installation", () => {
  test("l'URL publique et le SMTP se règlent dans l'admin, l'environnement prime", async () => {
    delete process.env.PUBLIC_URL;
    const { resetEnv } = await import("~/server/env.server");
    resetEnv();
    const saved = await call(system.saveConfig, {
      method: "PUT",
      cookie: session,
      body: {
        publicUrl: "https://atelier.example/",
        smtp: {
          host: "smtp.example",
          port: 465,
          user: "u",
          pass: "secret",
          from: "",
        },
      },
    });
    expect(saved.status).toBe(200);
    // Le mot de passe n'est jamais renvoyé.
    expect(saved.data.config.smtp.pass).toBe("");
    expect(saved.data.config.smtp.hasPass).toBe(true);
    expect(saved.data.config.effective.sources).toEqual({
      publicUrl: "admin",
      smtp: "admin",
    });
    expect(sitemap()).toContain("https://atelier.example/");
    // Enregistrer sans mot de passe garde l'ancien.
    await call(system.saveConfig, {
      method: "PUT",
      cookie: session,
      body: {
        publicUrl: "https://atelier.example",
        smtp: { host: "smtp.example", pass: "" },
      },
    });
    const row = db().get<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'config'",
    );
    expect(JSON.parse(row?.value ?? "{}").smtp.pass).toBe("secret");
    process.env.PUBLIC_URL = "http://site.test";
    resetEnv();
    const status = await call(system.status, { cookie: session });
    expect(status.data.config.effective.sources.publicUrl).toBe("env");
    expect(sitemap()).toContain("http://site.test/");
  });
});

/* Faux GitHub : une Release avec son archive de build, ses empreintes et ses notes */
function fakeRelease(
  version: string,
  options: { tamper?: boolean; apiStatus?: number; webStatus?: number } = {},
) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "twsb-release-"));
  fs.mkdirSync(path.join(work, ".output", "server"), { recursive: true });
  fs.writeFileSync(path.join(work, ".output", "server", "index.mjs"), "// app");
  fs.writeFileSync(path.join(work, ".output", "VERSION"), version);
  const name = `twsb-v${version}.tar.gz`;
  const archive = path.join(work, name);
  spawnSync("tar", ["-czf", archive, "-C", work, ".output"]);
  const bytes = fs.readFileSync(archive);
  const sum = createHash("sha256")
    .update(options.tamper ? "autre" : bytes)
    .digest("hex");
  const tag = `v${version}`;
  const limited = (status: number) =>
    new Response("limite", {
      status,
      headers: {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": "1795600000",
      },
    });
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (input: string | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith("https://api.github.com/")) {
      if (options.apiStatus) return limited(options.apiStatus);
      return Response.json({ tag_name: tag, body: "- Par l'API", assets: [] });
    }
    if (url.endsWith("/releases/latest")) {
      if (options.webStatus) return limited(options.webStatus);
      return new Response(null, {
        status: 302,
        headers: {
          location: `https://github.com/kazerlelutin/twsb/releases/tag/${tag}`,
        },
      });
    }
    if (url.endsWith(`/download/${tag}/release-notes.md`))
      return new Response("## Nouveautés\n\n- Nouveautés");
    if (url.endsWith(`/download/${tag}/${name}`)) return new Response(bytes);
    if (url.endsWith(`/download/${tag}/checksums.txt`))
      return new Response(`${sum}  ${name}\n`);
    return new Response("?", { status: 404 });
  });
  return calls;
}

describe("mises à jour", () => {
  test("sans jeton, la dernière version est lue hors API (pas de limite à 60/h)", async () => {
    const calls = fakeRelease("9.0.0");
    const status = await call(system.status, {
      cookie: session,
      path: "/api/system?check=1",
    });
    expect(status.data.latest).toMatchObject({
      version: "9.0.0",
      notes: "## Nouveautés\n\n- Nouveautés",
      url: "https://github.com/kazerlelutin/twsb/releases/tag/v9.0.0",
    });
    expect(calls.some((u) => u.includes("api.github.com"))).toBe(false);
  });

  test("API limitée avec un jeton : bascule sur les pages publiques ; sinon message clair", async () => {
    process.env.GITHUB_TOKEN = "jeton-de-test";
    try {
      fakeRelease("9.0.0", { apiStatus: 403 });
      const ok = await call(system.status, {
        cookie: session,
        path: "/api/system?check=1",
      });
      expect(ok.data.latest.version).toBe("9.0.0");
      fakeRelease("9.0.0", { apiStatus: 403, webStatus: 429 });
      const ko = await call(system.status, {
        cookie: session,
        path: "/api/system?check=1",
      });
      expect(ko.data.checkError).toMatch(
        /^Limite de requêtes GitHub atteinte\. Réessayez vers \d\d:\d\d\.$/,
      );
    } finally {
      delete process.env.GITHUB_TOKEN;
    }
  });

  test("nouvelle version : sauvegarde, archive vérifiée, installée, en attente d'essai", async () => {
    fakeRelease("9.0.0");
    const status = await call(system.status, {
      cookie: session,
      path: "/api/system?check=1",
    });
    expect(status.data).toMatchObject({
      updateAvailable: true,
      latest: { version: "9.0.0" },
    });
    const res = await call(system.update, { method: "POST", cookie: session });
    // Hors lanceur (tests, dev) : redémarrage manuel annoncé.
    expect(res.data.progress.step).toBe("manual");
    expect(
      fs.existsSync(
        path.join(
          dataDir,
          "releases",
          "9.0.0",
          ".output",
          "server",
          "index.mjs",
        ),
      ),
    ).toBe(true);
    const state = readState(dataDir);
    expect(state.pending?.version).toBe("9.0.0");
    expect(fs.existsSync(state.pending?.backup ?? "")).toBe(true);
    const backups = (await call(system.status, { cookie: session })).data
      .backups;
    expect(backups[0]).toMatchObject({
      reason: "Avant la mise à jour en 9.0.0",
    });
  });

  test("empreinte invalide : rien n'est installé", async () => {
    fakeRelease("9.0.1", { tamper: true });
    const res = await call(system.update, { method: "POST", cookie: session });
    expect(res.data.progress).toMatchObject({ step: "error" });
    expect(res.data.progress.message).toContain("Empreinte");
    expect(fs.existsSync(path.join(dataDir, "releases", "9.0.1"))).toBe(false);
    expect(readState(dataDir).pending).toBeUndefined();
    // La sauvegarde de la tentative échouée n'est pas gardée.
    expect(
      (await call(system.status, { cookie: session })).data.backups,
    ).toEqual([]);
  });

  test("le retour arrière exige le lanceur ; les sauvegardes se créent et se suppriment", async () => {
    await call(system.backup, { method: "POST", cookie: session });
    const [backup] = (await call(system.status, { cookie: session })).data
      .backups;
    expect(backup.reason).toBe("Sauvegarde manuelle");
    const revert = await call(system.revert, {
      cookie: session,
      body: { name: backup.name },
    });
    expect(revert.status).toBe(409);
    expect(
      (
        await call(system.removeBackup, {
          method: "DELETE",
          cookie: session,
          params: { name: "../site.sqlite" },
        })
      ).status,
    ).toBe(409);
    await call(system.removeBackup, {
      method: "DELETE",
      cookie: session,
      params: { name: backup.name },
    });
    expect(
      (await call(system.status, { cookie: session })).data.backups,
    ).toEqual([]);
  });
});
