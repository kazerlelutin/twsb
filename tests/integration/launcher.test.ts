// @vitest-environment node
import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  chooseTarget,
  compareVersions,
  readState,
  writeState,
} from "../../launcher/core.mjs";

describe("lanceur : choix de la version", () => {
  const installed =
    (...versions: string[]) =>
    (v: string) =>
      versions.includes(v);

  test("compare les versions", () => {
    expect(compareVersions("1.10.0", "1.9.3")).toBe(1);
    expect(compareVersions("v1.2.3", "1.2.3")).toBe(0);
    expect(compareVersions("0.9.0", "1.0.0")).toBe(-1);
  });

  test("essaie la mise à jour en attente, sinon la version la plus récente", () => {
    expect(
      chooseTarget(
        {
          pending: { version: "1.1.0" },
          current: "1.0.0",
          lastRun: "1.0.0",
          failed: [],
        },
        "1.0.0",
        installed("1.1.0"),
      ),
    ).toEqual({ version: "1.1.0", trial: true });
    // Image plus récente que la version installée (docker pull) : essai.
    expect(
      chooseTarget(
        { current: "1.0.0", lastRun: "1.0.0", failed: [] },
        "1.2.0",
        installed("1.0.0"),
      ),
    ).toEqual({ version: "1.2.0", trial: true });
    // Une version en échec n'est plus choisie.
    expect(
      chooseTarget(
        {
          current: "1.0.0",
          lastRun: "1.0.0",
          failed: [{ version: "1.2.0", at: 0, reason: "" }],
        },
        "1.2.0",
        installed("1.0.0"),
      ),
    ).toEqual({ version: "1.0.0", trial: false });
    // Premier lancement : pas d'essai.
    expect(chooseTarget({ failed: [] }, "1.0.0", installed())).toEqual({
      version: "1.0.0",
      trial: false,
    });
  });
});

/* Lanceur réel, avec de fausses versions de l'application */
const fakeServer = (version: string, crash = false) => `
import fs from "node:fs";
// Une version défaillante abîme la base (migration ratée) puis s'arrête.
${crash ? 'fs.writeFileSync(process.env.DATA_DIR + "/site.sqlite", "base abîmée"); process.exit(1);' : ""}
const server = Bun.serve({
  port: Number(process.env.PORT),
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/restart") {
      setTimeout(() => process.exit(75), 50);
      return new Response("ok");
    }
    return Response.json({ status: "ok", version: "${version}" });
  },
});
process.on("SIGTERM", () => { server.stop(); process.exit(0); });
`;

function fakeApp(version: string, dir: string, crash = false) {
  fs.mkdirSync(path.join(dir, ".output", "server"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".output", "VERSION"), `${version}\n`);
  fs.writeFileSync(
    path.join(dir, ".output", "server", "index.mjs"),
    fakeServer(version, crash),
  );
}

let launcher: ChildProcess | undefined;
afterEach(() => {
  launcher?.kill("SIGTERM");
  launcher = undefined;
});

async function startLauncher(root: string, data: string, port: number) {
  launcher = spawn("bun", [path.join(root, "launcher", "launcher.mjs")], {
    env: {
      ...process.env,
      DATA_DIR: data,
      PORT: String(port),
      TWSB_HEALTH_TIMEOUT: "8000",
    },
    stdio: "ignore",
  });
}

async function waitFor<T>(fn: () => T | Promise<T>, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const value = await fn();
      if (value) return value;
    } catch {
      // Pas encore.
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("délai dépassé");
}

const versionOn = async (port: number) =>
  (await (await fetch(`http://127.0.0.1:${port}/healthz`)).json()).version;

function setup(bundled: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "twsb-launcher-"));
  const data = path.join(root, "data");
  fs.mkdirSync(data);
  fs.cpSync(path.resolve("launcher"), path.join(root, "launcher"), {
    recursive: true,
  });
  fakeApp(bundled, root);
  return { root, data, port: 20_000 + Math.floor(Math.random() * 20_000) };
}

describe("lanceur : mise à jour et retour arrière", () => {
  test("une mise à jour saine est adoptée", async () => {
    const { root, data, port } = setup("1.0.0");
    fakeApp("1.1.0", path.join(data, "releases", "1.1.0"));
    writeState(data, {
      failed: [],
      lastRun: "1.0.0",
      pending: { version: "1.1.0" },
    });
    await startLauncher(root, data, port);
    expect(await waitFor(() => versionOn(port))).toBe("1.1.0");
    await waitFor(() => readState(data).current === "1.1.0");
    expect(readState(data)).toMatchObject({
      current: "1.1.0",
      lastRun: "1.1.0",
      previous: "1.0.0",
    });
    expect(readState(data).pending).toBeUndefined();
  }, 30_000);

  test("une version qui ne démarre pas : base restaurée, ancienne version relancée", async () => {
    const { root, data, port } = setup("1.0.0");
    fs.writeFileSync(path.join(data, "site.sqlite"), "schéma 1.0.0");
    const backup = path.join(data, "avant.sqlite");
    fs.copyFileSync(path.join(data, "site.sqlite"), backup);
    fakeApp("2.0.0", path.join(data, "releases", "2.0.0"), true);
    writeState(data, {
      failed: [],
      lastRun: "1.0.0",
      current: "1.0.0",
      pending: { version: "2.0.0", backup },
    });
    await startLauncher(root, data, port);
    expect(await waitFor(() => versionOn(port))).toBe("1.0.0");
    const state = readState(data);
    expect(state.failed.map((f) => f.version)).toEqual(["2.0.0"]);
    expect(state.pending).toBeUndefined();
    expect(state.current).toBe("1.0.0");
    expect(fs.readFileSync(path.join(data, "site.sqlite"), "utf8")).toBe(
      "schéma 1.0.0",
    );
  }, 30_000);

  test("retour arrière demandé : la sauvegarde remplace la base, puis redémarrage", async () => {
    const { root, data, port } = setup("1.0.0");
    await startLauncher(root, data, port);
    expect(await waitFor(() => versionOn(port))).toBe("1.0.0");
    const backup = path.join(data, "ancienne.sqlite");
    fs.writeFileSync(backup, "contenu sauvegardé");
    writeState(data, {
      ...readState(data),
      restore: { backup, version: "1.0.0" },
    });
    await fetch(`http://127.0.0.1:${port}/restart`);
    await waitFor(() => readState(data).restore === undefined);
    expect(await waitFor(() => versionOn(port))).toBe("1.0.0");
    expect(fs.readFileSync(path.join(data, "site.sqlite"), "utf8")).toBe(
      "contenu sauvegardé",
    );
  }, 30_000);
});
