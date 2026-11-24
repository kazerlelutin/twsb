// Lanceur de production : démarre la bonne version de TWSB, essaie les mises à jour
// et revient automatiquement à la version précédente si la nouvelle ne démarre pas.
//
//   bun launcher/launcher.mjs
//
// Version de l'image : .output/ à côté de ce dossier. Versions installées depuis
// l'admin : DATA_DIR/releases/<version>/.output. État : DATA_DIR/releases/state.json.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  backupDatabaseFiles,
  chooseTarget,
  RESTART_CODE,
  readState,
  releaseEntry,
  restoreDatabase,
  writeState,
} from "./core.mjs";

const appRoot = path.resolve(import.meta.dirname, "..");
const bundledEntry = path.join(appRoot, ".output", "server", "index.mjs");
const bundledVersion = readVersion(path.join(appRoot, ".output", "VERSION"));
const dataDir = path.resolve(process.env.DATA_DIR || "data");
const port = Number(process.env.PORT || 3000);
const HEALTH_TIMEOUT = Number(process.env.TWSB_HEALTH_TIMEOUT || 90_000);

let child;
let stopping = false;

function readVersion(file) {
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {
    return "0.0.0";
  }
}

const log = (message) => console.log(`[lanceur] ${message}`);

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    stopping = true;
    if (child) child.kill(signal);
    else process.exit(0);
  });
}

const isInstalled = (version) =>
  version === bundledVersion || fs.existsSync(releaseEntry(dataDir, version));
const entryFor = (version) => {
  const installed = releaseEntry(dataDir, version);
  return fs.existsSync(installed) ? installed : bundledEntry;
};

/** Attend que /healthz réponde avec la version attendue (base ouverte, migrations jouées). */
async function waitHealthy(version, exited) {
  const deadline = Date.now() + HEALTH_TIMEOUT;
  while (Date.now() < deadline && !exited()) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        if (!body.version || body.version === version) return true;
      }
    } catch {
      // Pas encore prêt.
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function rollback(state, target, reason) {
  const backup = state.pending?.backup ?? state.trialBackup;
  log(`échec de la version ${target.version} (${reason}) : retour arrière`);
  if (backup) restoreDatabase(dataDir, backup);
  state.failed = [
    ...(state.failed ?? []).filter((f) => f.version !== target.version),
    { version: target.version, at: Date.now(), reason },
  ];
  delete state.pending;
  delete state.trialBackup;
  writeState(dataDir, state);
}

/** Lance une version ; à l'essai, la valide ou revient en arrière. Renvoie le code de sortie. */
async function start(target) {
  let state = readState(dataDir);
  if (target.trial && !state.pending?.backup) {
    // Mise à jour de l'image (docker pull) : sauvegarde avant les migrations.
    state.trialBackup = backupDatabaseFiles(
      dataDir,
      state.lastRun ?? bundledVersion,
      `Avant le passage en ${target.version}`,
    );
    writeState(dataDir, state);
  }
  log(
    `démarrage de la version ${target.version}${target.trial ? " (essai)" : ""}`,
  );
  let exitCode;
  child = spawn(process.execPath, [entryFor(target.version)], {
    stdio: "inherit",
    env: {
      ...process.env,
      TWSB_LAUNCHER: "1",
      TWSB_BUNDLED_VERSION: bundledVersion,
    },
  });
  const exited = new Promise((resolve) =>
    child.on("exit", (code, signal) => {
      exitCode = code ?? (signal ? 1 : 0);
      resolve(exitCode);
    }),
  );
  const healthy = await waitHealthy(
    target.version,
    () => exitCode !== undefined,
  );
  state = readState(dataDir);
  if (!healthy && !stopping) {
    if (exitCode === undefined) child.kill("SIGTERM");
    await exited;
    if (target.trial) {
      rollback(
        state,
        target,
        exitCode === undefined ? "délai dépassé" : `arrêt (code ${exitCode})`,
      );
      return RESTART_CODE;
    }
    return exitCode ?? 1;
  }
  if (healthy) {
    if (
      target.trial ||
      state.current !== target.version ||
      state.lastRun !== target.version
    ) {
      if (state.current !== target.version)
        state.previous = state.current ?? state.lastRun;
      state.current = target.version;
      state.lastRun = target.version;
      delete state.pending;
      delete state.trialBackup;
      writeState(dataDir, state);
    }
    log(`version ${target.version} en service`);
  }
  return exited;
}

/** Le dossier de données doit exister et être accessible en écriture (volume persistant). */
function checkDataDir() {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const probe = path.join(dataDir, `.write-test-${process.pid}`);
    fs.writeFileSync(probe, "ok");
    fs.rmSync(probe);
  } catch (error) {
    const relative = !path.isAbsolute(process.env.DATA_DIR || "/");
    console.error(
      [
        `[lanceur] Dossier de données inutilisable : ${dataDir} (${error.code ?? error.message}).`,
        relative
          ? "[lanceur] DATA_DIR est un chemin relatif : utilisez un chemin absolu, par exemple /data, ou retirez la variable (l'image utilise /data)."
          : "[lanceur] Vérifiez que ce dossier est un volume persistant accessible en écriture (CapRover : Répertoire persistant, chemin dans l'app /data).",
      ].join("\n"),
    );
    process.exit(1);
  }
}

async function main() {
  checkDataDir();
  log(`données : ${dataDir} | port : ${port}`);
  while (true) {
    const state = readState(dataDir);
    if (state.restore) {
      // Retour arrière demandé depuis l'admin : base sauvegardée et version associée.
      log(`restauration de ${path.basename(state.restore.backup)}`);
      restoreDatabase(dataDir, state.restore.backup);
      state.current = state.restore.version;
      state.lastRun = state.restore.version;
      state.failed = (state.failed ?? []).filter(
        (f) => f.version !== state.restore.version,
      );
      delete state.restore;
      delete state.pending;
      writeState(dataDir, state);
    }
    const target = chooseTarget(
      readState(dataDir),
      bundledVersion,
      isInstalled,
    );
    const code = await start(target);
    if (stopping) process.exit(0);
    if (code === RESTART_CODE) continue;
    process.exit(code);
  }
}

main().catch((error) => {
  console.error("[lanceur]", error);
  process.exit(1);
});
