// Logique du lanceur, partagée avec le serveur (pas de dépendance) :
// état des versions, choix de la version à lancer, sauvegarde et restauration de la base.
import fs from "node:fs";
import path from "node:path";

/** Code de sortie demandant au lanceur de redémarrer (mise à jour, retour arrière). */
export const RESTART_CODE = 75;

/** Compare « 1.2.3 » et « v1.2.10 » (préfixe v et suffixe -… ignorés). */
export function compareVersions(a, b) {
  const parts = (v) =>
    String(v)
      .replace(/^v/, "")
      .split("-")[0]
      .split(".")
      .map((n) => Number.parseInt(n, 10) || 0);
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) {
    const diff = (x[i] ?? 0) - (y[i] ?? 0);
    if (diff) return Math.sign(diff);
  }
  return 0;
}

export const cleanVersion = (v) => String(v).trim().replace(/^v/, "");

export function paths(dataDir) {
  const releases = path.join(dataDir, "releases");
  return {
    releases,
    state: path.join(releases, "state.json"),
    backups: path.join(dataDir, "backups"),
    db: path.join(dataDir, "site.sqlite"),
  };
}

export const releaseDir = (dataDir, version) =>
  path.join(paths(dataDir).releases, cleanVersion(version));
export const releaseEntry = (dataDir, version) =>
  path.join(releaseDir(dataDir, version), ".output", "server", "index.mjs");

/**
 * État : version en service (current), dernière version lancée avec succès (lastRun),
 * mise à jour à essayer (pending), restauration demandée (restore), échecs (failed).
 */
export function readState(dataDir) {
  try {
    const state = JSON.parse(fs.readFileSync(paths(dataDir).state, "utf8"));
    return { failed: [], ...state };
  } catch {
    return { failed: [] };
  }
}

export function writeState(dataDir, state) {
  const file = paths(dataDir).state;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

/**
 * Version à lancer : la mise à jour en attente (à l'essai), sinon la plus récente
 * entre celle de l'image et celle installée dans /data, hors versions en échec.
 */
export function chooseTarget(state, bundledVersion, isInstalled) {
  const pending = state.pending?.version;
  if (pending && isInstalled(pending)) return { version: pending, trial: true };
  const failed = new Set((state.failed ?? []).map((f) => f.version));
  const candidates = [bundledVersion];
  if (state.current && isInstalled(state.current))
    candidates.push(state.current);
  const usable = candidates.filter((v) => !failed.has(v));
  const pool = usable.length ? usable : [bundledVersion];
  const version = pool.sort((a, b) => compareVersions(b, a))[0];
  // Une version jamais lancée sur cette base est d'abord essayée.
  return { version, trial: !!state.lastRun && state.lastRun !== version };
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");

/** Copie de la base, application arrêtée (avec son journal WAL). */
export function backupDatabaseFiles(dataDir, version, reason) {
  const { db, backups } = paths(dataDir);
  if (!fs.existsSync(db)) return undefined;
  fs.mkdirSync(backups, { recursive: true });
  const name = `${stamp()}-v${cleanVersion(version)}`;
  const file = path.join(backups, `${name}.sqlite`);
  fs.copyFileSync(db, file);
  for (const suffix of ["-wal", "-shm"])
    if (fs.existsSync(db + suffix)) fs.copyFileSync(db + suffix, file + suffix);
  writeBackupMeta(file, { version: cleanVersion(version), reason });
  return file;
}

export function writeBackupMeta(file, meta) {
  fs.writeFileSync(
    file.replace(/\.sqlite$/, ".json"),
    `${JSON.stringify({ createdAt: Date.now(), ...meta }, null, 2)}\n`,
  );
}

/** Remet la base dans l'état d'une sauvegarde (application arrêtée). */
export function restoreDatabase(dataDir, backupFile) {
  const { db } = paths(dataDir);
  if (!fs.existsSync(backupFile))
    throw new Error(`Sauvegarde introuvable : ${backupFile}`);
  for (const suffix of ["-wal", "-shm"])
    fs.rmSync(db + suffix, { force: true });
  fs.copyFileSync(backupFile, db);
  for (const suffix of ["-wal", "-shm"])
    if (fs.existsSync(backupFile + suffix))
      fs.copyFileSync(backupFile + suffix, db + suffix);
}
