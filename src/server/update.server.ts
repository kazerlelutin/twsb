import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  cleanVersion,
  compareVersions,
  paths,
  RESTART_CODE,
  readState,
  releaseDir,
  releaseEntry,
  writeBackupMeta,
  writeState,
} from "../../launcher/core.mjs";
import { db } from "./db.server";
import { env } from "./env.server";
import { APP_VERSION } from "./version.server";

export class UpdateError extends Error {}

/** Dépôt GitHub des versions publiées (Releases) ; jeton requis si le dépôt est privé. */
const repo = () => process.env.TWSB_UPDATE_REPO || "kazerlelutin/twsb";
/** API GitHub (ou compatible : GitHub Enterprise, miroir). */
const apiBase = () =>
  (process.env.TWSB_UPDATE_API || "https://api.github.com").replace(/\/+$/, "");
const token = () => process.env.GITHUB_TOKEN || process.env.TWSB_GITHUB_TOKEN;
const underLauncher = () => process.env.TWSB_LAUNCHER === "1";
const bundledVersion = () => process.env.TWSB_BUNDLED_VERSION || APP_VERSION;

export type ReleaseInfo = {
  version: string;
  name: string;
  notes: string;
  publishedAt: string;
  url: string;
  asset?: { name: string; url: string; size: number };
  checksums?: { name: string; url: string };
};

type GithubAsset = {
  name: string;
  url: string;
  browser_download_url: string;
  size: number;
};

const headers = (accept = "application/vnd.github+json") => {
  const h: Record<string, string> = {
    accept,
    "user-agent": "twsb-updater",
    "x-github-api-version": "2022-11-28",
  };
  if (token()) h.authorization = `Bearer ${token()}`;
  return h;
};

/** Archive de build d'une Release : twsb-v1.2.3.tar.gz, et ses empreintes. */
export function parseRelease(data: {
  tag_name: string;
  name?: string;
  body?: string;
  published_at?: string;
  html_url?: string;
  assets?: GithubAsset[];
}): ReleaseInfo {
  const pick = (test: (name: string) => boolean) => {
    const a = data.assets?.find((x) => test(x.name));
    // Avec un jeton, l'URL d'API fonctionne aussi pour un dépôt privé.
    return a
      ? {
          name: a.name,
          url: token() ? a.url : a.browser_download_url,
          size: a.size,
        }
      : undefined;
  };
  return {
    version: cleanVersion(data.tag_name),
    name: data.name || data.tag_name,
    notes: data.body ?? "",
    publishedAt: data.published_at ?? "",
    url: data.html_url ?? "",
    asset: pick((n) => /^twsb-v?\d+\.\d+\.\d+.*\.tar\.gz$/.test(n)),
    checksums: pick((n) => n === "checksums.txt"),
  };
}

let latest: { at: number; release?: ReleaseInfo; error?: string } | undefined;
const CHECK_EVERY = 6 * 3600_000;

/** Dernière version publiée (mise en cache six heures). */
export async function checkLatest(force = false) {
  // Un échec (GitHub injoignable) n'est retenu que quelques minutes.
  const ttl = latest?.error ? 5 * 60_000 : CHECK_EVERY;
  if (!force && latest && Date.now() - latest.at < ttl) return latest;
  try {
    const res = await fetch(`${apiBase()}/repos/${repo()}/releases/latest`, {
      headers: headers(),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 404)
      throw new UpdateError(
        token()
          ? "Aucune version publiée."
          : "Aucune version trouvée (dépôt privé : jeton GITHUB_TOKEN requis).",
      );
    if (!res.ok) throw new UpdateError(`GitHub répond ${res.status}.`);
    latest = { at: Date.now(), release: parseRelease(await res.json()) };
  } catch (error) {
    latest = {
      at: Date.now(),
      error:
        error instanceof UpdateError
          ? error.message
          : "GitHub injoignable pour le moment.",
    };
  }
  return latest;
}

/* Sauvegardes de la base (avant mise à jour, ou à la demande) */
export type BackupInfo = {
  name: string;
  version: string;
  reason: string;
  createdAt: number;
  size: number;
};

export function listBackups(): BackupInfo[] {
  const dir = paths(env().dataDir).backups;
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sqlite"))
    .map((file) => {
      const full = path.join(dir, file);
      let meta: { version?: string; reason?: string; createdAt?: number } = {};
      try {
        meta = JSON.parse(
          fs.readFileSync(full.replace(/\.sqlite$/, ".json"), "utf8"),
        );
      } catch {
        // Sauvegarde sans fiche : on garde le fichier.
      }
      const stat = fs.statSync(full);
      return {
        name: file,
        version: meta.version ?? "?",
        reason: meta.reason ?? "",
        createdAt: meta.createdAt ?? stat.mtimeMs,
        size: stat.size,
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

const backupPath = (name: string) => {
  if (!/^[\w.-]+\.sqlite$/.test(name))
    throw new UpdateError("Sauvegarde invalide.");
  const file = path.join(paths(env().dataDir).backups, name);
  if (!fs.existsSync(file)) throw new UpdateError("Sauvegarde introuvable.");
  return file;
};

/** Copie cohérente de la base en service (VACUUM INTO), avec sa fiche. */
export function createBackup(reason: string) {
  const dir = paths(env().dataDir).backups;
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(dir, `${stamp}-v${APP_VERSION}.sqlite`);
  db().exec(`VACUUM INTO '${file.replaceAll("'", "''")}'`);
  writeBackupMeta(file, { version: APP_VERSION, reason });
  return file;
}

export function deleteBackup(name: string) {
  const file = backupPath(name);
  fs.rmSync(file, { force: true });
  fs.rmSync(file.replace(/\.sqlite$/, ".json"), { force: true });
}

/* Déroulé d'une mise à jour, suivi par l'admin */
export type UpdateStep =
  | "idle"
  | "backup"
  | "download"
  | "verify"
  | "install"
  | "restart"
  | "manual"
  | "error";

let progress: { step: UpdateStep; version?: string; message?: string } = {
  step: "idle",
};
export const updateProgress = () => progress;

const sha256 = (file: string) =>
  createHash("sha256").update(fs.readFileSync(file)).digest("hex");

async function download(url: string, file: string, accept: string) {
  const res = await fetch(url, {
    headers: headers(accept),
    redirect: "follow",
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok || !res.body)
    throw new UpdateError(`Téléchargement impossible (${res.status}).`);
  fs.writeFileSync(file, new Uint8Array(await res.arrayBuffer()));
}

/** Planifie le redémarrage par le lanceur, après l'envoi de la réponse. */
function restartSoon() {
  if (!underLauncher()) return false;
  setTimeout(() => process.exit(RESTART_CODE), 800);
  return true;
}

/**
 * Mise à jour : sauvegarde de la base, téléchargement de l'archive, contrôle
 * de son empreinte, installation dans /data/releases, puis redémarrage.
 * Le lanceur essaie la nouvelle version et restaure la base si elle échoue.
 */
export async function runUpdate(release: ReleaseInfo) {
  if (
    ["backup", "download", "verify", "install", "restart"].includes(
      progress.step,
    )
  )
    throw new UpdateError("Une mise à jour est déjà en cours.");
  if (compareVersions(release.version, APP_VERSION) <= 0)
    throw new UpdateError("Cette version n'est pas plus récente.");
  if (!release.asset || !release.checksums)
    throw new UpdateError("Cette version ne contient pas d'archive de build.");
  const { asset, checksums } = release;
  const dataDir = env().dataDir;
  const work = path.join(paths(dataDir).releases, ".download");
  const step = (s: UpdateStep, message?: string) => {
    progress = { step: s, version: release.version, message };
  };
  try {
    step("backup");
    const backup = createBackup(`Avant la mise à jour en ${release.version}`);
    step("download");
    fs.rmSync(work, { recursive: true, force: true });
    fs.mkdirSync(work, { recursive: true });
    const archive = path.join(work, asset.name);
    const sums = path.join(work, "checksums.txt");
    await download(asset.url, archive, "application/octet-stream");
    await download(checksums.url, sums, "application/octet-stream");
    step("verify");
    const expected = fs
      .readFileSync(sums, "utf8")
      .split("\n")
      .map((l) => l.trim().split(/\s+\*?/))
      .find(([, name]) => name === asset.name)?.[0];
    if (!expected || expected !== sha256(archive))
      throw new UpdateError(
        "Empreinte de l'archive invalide : mise à jour annulée.",
      );
    step("install");
    const target = releaseDir(dataDir, release.version);
    const tmp = `${target}.tmp`;
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });
    const tar = spawnSync(
      "tar",
      ["-xzf", archive, "-C", tmp, "--no-same-owner"],
      {
        encoding: "utf8",
      },
    );
    if (tar.status !== 0)
      throw new UpdateError(`Archive illisible : ${tar.stderr || tar.error}`);
    if (!fs.existsSync(path.join(tmp, ".output", "server", "index.mjs")))
      throw new UpdateError("Archive incomplète.");
    fs.rmSync(target, { recursive: true, force: true });
    fs.renameSync(tmp, target);
    fs.rmSync(work, { recursive: true, force: true });
    const state = readState(dataDir);
    state.pending = {
      version: release.version,
      backup,
      from: APP_VERSION,
      at: Date.now(),
    };
    writeState(dataDir, state);
    if (restartSoon()) step("restart");
    else
      step(
        "manual",
        "Version installée : redémarrez avec le lanceur (bun launcher/launcher.mjs).",
      );
  } catch (error) {
    fs.rmSync(work, { recursive: true, force: true });
    step(
      "error",
      error instanceof UpdateError ? error.message : "Mise à jour impossible.",
    );
    if (!(error instanceof UpdateError)) console.error(error);
  }
  return progress;
}

/** Retour arrière : la base revient à une sauvegarde, avec la version qui l'a produite. */
export function revertTo(name: string) {
  const file = backupPath(name);
  const backup = listBackups().find((b) => b.name === name);
  const version = backup?.version ?? APP_VERSION;
  const dataDir = env().dataDir;
  const runnable =
    version === bundledVersion() ||
    version === APP_VERSION ||
    fs.existsSync(releaseEntry(dataDir, version));
  if (!runnable)
    throw new UpdateError(
      `La version ${version} n'est plus installée : restauration impossible.`,
    );
  if (!underLauncher())
    throw new UpdateError(
      "Le retour arrière nécessite le lanceur (bun launcher/launcher.mjs).",
    );
  const state = readState(dataDir);
  state.restore = { backup: file, version };
  writeState(dataDir, state);
  progress = { step: "restart", version };
  restartSoon();
}

/** État affiché dans l'admin : version, dernière publiée, essais échoués, sauvegardes. */
export async function systemStatus(force = false) {
  const check = await checkLatest(force);
  const state = readState(env().dataDir);
  const release = check.release;
  return {
    version: APP_VERSION,
    bundledVersion: bundledVersion(),
    repo: repo(),
    launcher: underLauncher(),
    latest: release,
    checkError: check.error,
    checkedAt: check.at,
    updateAvailable:
      !!release && compareVersions(release.version, APP_VERSION) > 0,
    previous: state.previous as string | undefined,
    failed: (state.failed ?? []) as {
      version: string;
      at: number;
      reason: string;
    }[],
    progress: progress,
    backups: listBackups(),
  };
}
