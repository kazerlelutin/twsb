import fs from "node:fs";
import path from "node:path";
import { actor } from "./actor.server";
import { db, json, now, uid } from "./db.server";
import { env } from "./env.server";

/** Éléments versionnés : chacun a son historique et peut être restauré. */
export type RevisionEntity =
  | "content"
  | "type"
  | "layout"
  | "menu"
  | "tag"
  | "media"
  | "identity"
  | "plugins";

export type RevisionAction = "create" | "update" | "delete" | "restore";

export type RevisionSummary = {
  id: string;
  entity: RevisionEntity;
  entityId: string;
  action: RevisionAction;
  label: string;
  userName: string | null;
  createdAt: number;
};

type RevisionRow = {
  id: string;
  entity: RevisionEntity;
  entity_id: string;
  action: RevisionAction;
  label: string;
  data: string;
  user_name: string | null;
  created_at: number;
};

const toSummary = (r: RevisionRow): RevisionSummary => ({
  id: r.id,
  entity: r.entity,
  entityId: r.entity_id,
  action: r.action,
  label: r.label,
  userName: r.user_name,
  createdAt: r.created_at,
});

const SELECT = `SELECT r.*, u.name AS user_name FROM revisions r LEFT JOIN users u ON u.id = r.user_id`;

/** Les dates de mise à jour changent à chaque enregistrement : elles ne comptent pas comme une modification. */
const comparable = (data: string) =>
  data.replace(/"(updatedAt|updated_at)":\d+/g, "");

/**
 * Enregistre l'état d'un élément après une action. Une modification identique
 * à la dernière révision (enregistrement sans changement) n'est pas dupliquée.
 */
export function recordRevision(
  entity: RevisionEntity,
  entityId: string,
  action: RevisionAction,
  snapshot: unknown,
  label = "",
) {
  const data = JSON.stringify(snapshot ?? null);
  const context = actor();
  const finalAction: RevisionAction =
    context.restoring && action !== "delete" ? "restore" : action;
  if (finalAction === "update") {
    const last = db().get<{ data: string; action: RevisionAction }>(
      "SELECT data, action FROM revisions WHERE entity = ? AND entity_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1",
      entity,
      entityId,
    );
    if (
      last &&
      last.action !== "delete" &&
      comparable(last.data) === comparable(data)
    )
      return;
  }
  db().run(
    "INSERT INTO revisions (id, entity, entity_id, action, label, data, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    uid(),
    entity,
    entityId,
    finalAction,
    label.slice(0, 200),
    data,
    context.userId ?? null,
    now(),
  );
}

export const listRevisions = (entity: RevisionEntity, entityId: string) =>
  db()
    .all<RevisionRow>(
      `${SELECT} WHERE r.entity = ? AND r.entity_id = ? ORDER BY r.created_at DESC, r.rowid DESC LIMIT 200`,
      entity,
      entityId,
    )
    .map(toSummary);

export function getRevision(id: string) {
  const row = db().get<RevisionRow>(`${SELECT} WHERE r.id = ?`, id);
  return row
    ? { ...toSummary(row), data: json<Record<string, unknown>>(row.data, {}) }
    : undefined;
}

/** Éléments supprimés : dernière révision « suppression » de chacun. */
export function deletedItems(): RevisionSummary[] {
  return db()
    .all<RevisionRow>(
      `${SELECT} WHERE r.action = 'delete' AND r.created_at = (
         SELECT MAX(r2.created_at) FROM revisions r2 WHERE r2.entity = r.entity AND r2.entity_id = r.entity_id
       ) ORDER BY r.created_at DESC LIMIT 200`,
    )
    .map(toSummary);
}

/** Supprime les révisions plus anciennes que `days` jours, puis compacte la base. */
export function purgeRevisions(days: number) {
  const limit = now() - days * 86_400_000;
  const { changes } = db().run(
    "DELETE FROM revisions WHERE created_at < ?",
    limit,
  );
  if (changes > 0) {
    db().exec("PRAGMA wal_checkpoint(TRUNCATE)");
    db().exec("VACUUM");
  }
  return changes;
}

const fileSize = (file: string) => {
  try {
    return fs.statSync(file).size;
  } catch {
    return 0;
  }
};

function dirSize(dir: string): { bytes: number; files: number } {
  let bytes = 0;
  let files = 0;
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return { bytes, files };
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = dirSize(full);
      bytes += sub.bytes;
      files += sub.files;
    } else if (entry.isFile()) {
      bytes += fileSize(full);
      files++;
    }
  }
  return { bytes, files };
}

/** Occupation du dossier de données : base (avec journal WAL), médias, révisions. */
export function dataStats() {
  const base = path.join(env().dataDir, "site.sqlite");
  const media = dirSize(path.join(env().dataDir, "media"));
  const revisions = db().get<{
    n: number;
    bytes: number | null;
    oldest: number | null;
  }>(
    "SELECT COUNT(*) AS n, SUM(LENGTH(data)) AS bytes, MIN(created_at) AS oldest FROM revisions",
  );
  return {
    database:
      fileSize(base) + fileSize(`${base}-wal`) + fileSize(`${base}-shm`),
    media: media.bytes,
    mediaFiles: media.files,
    mediaItems:
      db().get<{ n: number }>("SELECT COUNT(*) AS n FROM media")?.n ?? 0,
    revisions: revisions?.n ?? 0,
    revisionsBytes: revisions?.bytes ?? 0,
    oldestRevision: revisions?.oldest ?? null,
  };
}
