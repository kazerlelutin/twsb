import fs from "node:fs/promises";
import path from "node:path";
import { unzipSync, type Zippable, zipSync } from "fflate";
import { db, openDb, setDb } from "./db.server";
import { env } from "./env.server";
import { mediaRoot } from "./media.server";
import {
  bumpVersion,
  getContent,
  getIdentity,
  listContents,
} from "./repo.server";
import { clearCache, renderContent } from "./site.server";

const FORMAT = "twsb-export";
const LEGACY_FORMATS = new Set([FORMAT, "webshell-export"]);
const VERSION = 1;

async function readTree(root: string, prefix: string, out: Zippable) {
  let entries: import("node:fs").Dirent[] = [];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory())
      await readTree(full, `${prefix}${entry.name}/`, out);
    else if (!entry.name.startsWith("icon-"))
      out[`${prefix}${entry.name}`] = [
        new Uint8Array(await fs.readFile(full)),
        { level: 0 },
      ];
  }
}

/** Archive complète : base SQLite, médias et site statique prêt à servir. */
export async function exportSite(options: { includeStatic?: boolean } = {}) {
  const dir = env().dataDir;
  const snapshot = path.join(dir, `export-${Date.now()}.sqlite`);
  db().exec(`VACUUM INTO '${snapshot.replaceAll("'", "''")}'`);
  const files: Zippable = {};
  try {
    files["site.sqlite"] = new Uint8Array(await fs.readFile(snapshot));
  } finally {
    await fs.rm(snapshot, { force: true });
  }
  await readTree(mediaRoot(), "media/", files);
  if (options.includeStatic !== false) {
    const { items } = listContents({ status: "published", limit: 10_000 });
    for (const item of items) {
      const content = getContent(item.id);
      const html = content ? renderContent(content) : undefined;
      if (!html) continue;
      const file =
        item.url === "/" ? "static/index.html" : `static${item.url}/index.html`;
      files[file] = new TextEncoder().encode(html);
    }
  }
  files["manifest.json"] = new TextEncoder().encode(
    JSON.stringify(
      {
        format: FORMAT,
        version: VERSION,
        site: getIdentity().name,
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  return zipSync(files, { level: 6 });
}

export class ImportError extends Error {}

const SAFE_ENTRY = /^media\/[\w-]+\/[\w.-]+$/;

/** Remplace la base et les médias par le contenu d'une archive. */
export async function importSite(archive: Uint8Array) {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(archive);
  } catch {
    throw new ImportError("Archive illisible.");
  }
  const manifest = entries["manifest.json"]
    ? JSON.parse(new TextDecoder().decode(entries["manifest.json"]))
    : undefined;
  if (!LEGACY_FORMATS.has(manifest?.format) || !entries["site.sqlite"])
    throw new ImportError("Ce n'est pas une archive TWSB.");

  const dir = env().dataDir;
  const incoming = path.join(dir, "import.sqlite");
  await fs.writeFile(incoming, entries["site.sqlite"]);
  try {
    const check = openDb(incoming);
    check.get("SELECT COUNT(*) FROM content_types");
    check.exec("DELETE FROM sessions");
    check.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    check.close();
  } catch (error) {
    await fs.rm(incoming, { force: true });
    if (error instanceof ImportError) throw error;
    throw new ImportError("Base de données invalide.");
  }

  const stagingMedia = path.join(dir, "media.import");
  await fs.rm(stagingMedia, { recursive: true, force: true });
  for (const [name, data] of Object.entries(entries)) {
    if (!name.startsWith("media/") || name.endsWith("/")) continue;
    if (!SAFE_ENTRY.test(name)) continue;
    const target = path.join(stagingMedia, name.slice("media/".length));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data);
  }

  const live = path.join(dir, "site.sqlite");
  setDb(undefined);
  for (const suffix of ["-wal", "-shm"])
    await fs.rm(live + suffix, { force: true });
  await fs.rename(incoming, live);
  for (const suffix of ["-wal", "-shm"])
    await fs.rm(incoming + suffix, { force: true });
  await fs.rm(mediaRoot(), { recursive: true, force: true });
  await fs.mkdir(stagingMedia, { recursive: true });
  await fs.rename(stagingMedia, mediaRoot());
  setDb(openDb(live));
  clearCache();
  bumpVersion();
  return { site: manifest.site as string };
}
