import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { env } from "./env.server";

type Param = string | number | bigint | null | Uint8Array | boolean | undefined;
type Row = Record<string, unknown>;

export interface Db {
  all<T = Row>(sql: string, ...params: Param[]): T[];
  get<T = Row>(sql: string, ...params: Param[]): T | undefined;
  run(sql: string, ...params: Param[]): { changes: number };
  exec(sql: string): void;
  tx<T>(fn: () => T): T;
  close(): void;
}

const migrations = import.meta.glob("../../migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const normalize = (params: Param[]) =>
  params.map((p) =>
    p === undefined ? null : typeof p === "boolean" ? Number(p) : p,
  );

/** Bun en production, node:sqlite dans Vitest : même API synchrone. */
export function openDb(file: string): Db {
  const require = createRequire(import.meta.url);
  // biome-ignore lint/suspicious/noExplicitAny: deux pilotes compatibles
  let raw: any;
  if (process.versions.bun) {
    const { Database } = require("bun:sqlite");
    raw = new Database(file, { create: true });
  } else {
    const { DatabaseSync } = require("node:sqlite");
    raw = new DatabaseSync(file);
  }
  raw.exec(
    "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;",
  );
  let depth = 0;
  const db: Db = {
    all: (sql, ...params) => raw.prepare(sql).all(...normalize(params)),
    get: (sql, ...params) =>
      raw.prepare(sql).get(...normalize(params)) ?? undefined,
    run: (sql, ...params) => {
      const result = raw.prepare(sql).run(...normalize(params));
      return { changes: Number(result.changes) };
    },
    exec: (sql) => raw.exec(sql),
    tx: (fn) => {
      if (depth > 0) return fn();
      depth++;
      raw.exec("BEGIN IMMEDIATE");
      try {
        const result = fn();
        raw.exec("COMMIT");
        return result;
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      } finally {
        depth--;
      }
    },
    close: () => raw.close(),
  };
  migrate(db);
  return db;
}

export function migrate(db: Db) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)",
  );
  const done = new Set(
    db.all<{ name: string }>("SELECT name FROM _migrations").map((r) => r.name),
  );
  for (const [file, sql] of Object.entries(migrations).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const name = path.basename(file);
    if (done.has(name)) continue;
    // Clés étrangères suspendues : une migration peut reconstruire une table.
    db.exec("PRAGMA foreign_keys = OFF");
    try {
      db.tx(() => {
        db.exec(sql);
        const broken = db.all("PRAGMA foreign_key_check");
        if (broken.length) throw new Error(`Migration ${name} : clés rompues`);
        db.run(
          "INSERT INTO _migrations (name, applied_at) VALUES (?, ?)",
          name,
          Date.now(),
        );
      });
    } finally {
      db.exec("PRAGMA foreign_keys = ON");
    }
  }
}

let instance: Db | undefined;
let onOpen: ((db: Db) => void) | undefined;
/** Amorçage exécuté une fois à l'ouverture de la base. */
export const onDbOpen = (fn: (db: Db) => void) => {
  onOpen = fn;
};

export function db(): Db {
  if (!instance) {
    const dir = env().dataDir;
    fs.mkdirSync(dir, { recursive: true });
    instance = openDb(path.join(dir, "site.sqlite"));
    onOpen?.(instance);
  }
  return instance;
}

/** Tests et import : remplace la base courante. */
export function setDb(next: Db | undefined) {
  instance?.close();
  instance = next;
  if (next) onOpen?.(next);
}

export const now = () => Date.now();
export const uid = () => crypto.randomUUID().replaceAll("-", "").slice(0, 16);
export const json = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};
