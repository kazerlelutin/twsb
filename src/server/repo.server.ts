import type { Block } from "../features/blocks/block.type";
import { slugify } from "../features/render/html";
import {
  type Content,
  type ContentStatus,
  type ContentSummary,
  type ContentType,
  DEFAULT_IDENTITY,
  DEFAULT_PLUGINS,
  type Identity,
  type Layout,
  type MediaInfo,
  type Menu,
  type Plugins,
  type Tag,
  type Translation,
} from "../features/site/site.type";
import { db, json, now, uid } from "./db.server";
import { recordRevision } from "./revisions.server";

/* Version du site : toute écriture invalide le cache public. */
let version = 0;
export const siteVersion = () => version;
export const bumpVersion = () => {
  version++;
};

/* Identité */
export function getIdentity(): Identity {
  const row = db().get<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'identity'",
  );
  const stored = json<Partial<Identity>>(row?.value, {});
  return {
    ...DEFAULT_IDENTITY,
    ...stored,
    colors: { ...DEFAULT_IDENTITY.colors, ...stored.colors },
    fonts: { ...DEFAULT_IDENTITY.fonts, ...stored.fonts },
  };
}

export function saveIdentity(identity: Identity) {
  db().run(
    "INSERT INTO settings (key, value) VALUES ('identity', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    JSON.stringify(identity),
  );
  bumpVersion();
  const saved = getIdentity();
  recordRevision("identity", "identity", "update", saved, saved.name);
  return saved;
}

/* Extensions */
export function getPlugins(): Plugins {
  const row = db().get<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'plugins'",
  );
  const stored = json<Partial<Plugins>>(row?.value, {});
  return {
    i18n: { ...DEFAULT_PLUGINS.i18n, ...stored.i18n },
  };
}

export function savePlugins(plugins: Plugins) {
  db().run(
    "INSERT INTO settings (key, value) VALUES ('plugins', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    JSON.stringify(plugins),
  );
  bumpVersion();
  const saved = getPlugins();
  recordRevision("plugins", "plugins", "update", saved, "Extensions");
  return saved;
}

/** Codes des langues secondaires actives (vide si l'extension est coupée). */
export const extraLanguages = () => {
  const { i18n } = getPlugins();
  return i18n.enabled ? i18n.languages.map((l) => l.code) : [];
};

/* Layouts */
type LayoutRow = {
  id: string;
  name: string;
  header: string;
  footer: string;
  options: string;
  is_default: number;
};
const toLayout = (r: LayoutRow): Layout => ({
  id: r.id,
  name: r.name,
  header: json<Block[]>(r.header, []),
  footer: json<Block[]>(r.footer, []),
  options: json(r.options, {}),
  isDefault: r.is_default === 1,
});

export const listLayouts = () =>
  db()
    .all<LayoutRow>("SELECT * FROM layouts ORDER BY is_default DESC, name")
    .map(toLayout);
export const getLayout = (id: string) => {
  const row = db().get<LayoutRow>("SELECT * FROM layouts WHERE id = ?", id);
  return row ? toLayout(row) : undefined;
};
export const defaultLayout = () => {
  const row = db().get<LayoutRow>(
    "SELECT * FROM layouts ORDER BY is_default DESC, created_at LIMIT 1",
  );
  return row ? toLayout(row) : undefined;
};

export function saveLayout(
  input: Partial<Layout> & { name: string },
  id = input.id ?? uid(),
): Layout {
  const t = now();
  const existed = !!getLayout(id);
  db().tx(() => {
    if (input.isDefault) db().run("UPDATE layouts SET is_default = 0");
    db().run(
      `INSERT INTO layouts (id, name, header, footer, options, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, header = excluded.header, footer = excluded.footer, options = excluded.options,
       is_default = CASE WHEN excluded.is_default = 1 THEN 1 ELSE layouts.is_default END, updated_at = excluded.updated_at`,
      id,
      input.name,
      JSON.stringify(input.header ?? []),
      JSON.stringify(input.footer ?? []),
      JSON.stringify(input.options ?? {}),
      input.isDefault ? 1 : 0,
      t,
      t,
    );
  });
  bumpVersion();
  const saved = getLayout(id) as Layout;
  recordRevision(
    "layout",
    id,
    existed ? "update" : "create",
    saved,
    saved.name,
  );
  return saved;
}

export function deleteLayout(id: string) {
  const layout = getLayout(id);
  if (!layout || layout.isDefault) return false;
  db().run("DELETE FROM layouts WHERE id = ?", id);
  recordRevision("layout", id, "delete", layout, layout.name);
  bumpVersion();
  return true;
}

/* Types de contenu */
type TypeRow = {
  id: string;
  name: string;
  prefix: string;
  layout_id: string | null;
  template: string;
  fields: string;
  has_body: number;
  builtin: number;
  position: number;
};
const toType = (r: TypeRow): ContentType => ({
  id: r.id,
  name: r.name,
  prefix: r.prefix,
  fields: json(r.fields, []),
  hasBody: r.has_body !== 0,
  layoutId: r.layout_id,
  template: json<Block[]>(r.template, []),
  builtin: r.builtin === 1,
  position: r.position,
});

export const listTypes = () =>
  db()
    .all<TypeRow>("SELECT * FROM content_types ORDER BY position, name")
    .map(toType);
export const getType = (id: string) => {
  const row = db().get<TypeRow>("SELECT * FROM content_types WHERE id = ?", id);
  return row ? toType(row) : undefined;
};
export const typeByPrefix = (prefix: string) => {
  const row = db().get<TypeRow>(
    "SELECT * FROM content_types WHERE prefix = ? AND prefix <> ''",
    prefix,
  );
  return row ? toType(row) : undefined;
};

export function saveType(
  input: Omit<ContentType, "builtin" | "position" | "fields" | "hasBody"> & {
    builtin?: boolean;
    position?: number;
    fields?: ContentType["fields"];
    hasBody?: boolean;
  },
): ContentType {
  const existedType = !!getType(input.id);
  const t = now();
  db().run(
    `INSERT INTO content_types (id, name, prefix, editor, layout_id, template, fields, has_body, builtin, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, (SELECT COUNT(*) FROM content_types)), ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, prefix = excluded.prefix, editor = excluded.editor,
     layout_id = excluded.layout_id, template = excluded.template, fields = excluded.fields, has_body = excluded.has_body,
     updated_at = excluded.updated_at`,
    input.id,
    input.name,
    input.prefix,
    "document",
    input.layoutId,
    JSON.stringify(input.template ?? []),
    JSON.stringify(input.fields ?? []),
    input.hasBody === false ? 0 : 1,
    input.builtin ? 1 : 0,
    input.position ?? null,
    t,
    t,
  );
  bumpVersion();
  const saved = getType(input.id) as ContentType;
  recordRevision(
    "type",
    saved.id,
    existedType ? "update" : "create",
    saved,
    saved.name,
  );
  return saved;
}

export function deleteType(id: string) {
  const type = getType(id);
  // Page reste toujours disponible : c'est le type de la page d'accueil.
  if (!type || type.id === "page") return false;
  db().run("DELETE FROM content_types WHERE id = ?", id);
  recordRevision("type", id, "delete", type, type.name);
  bumpVersion();
  return true;
}

/* Contenus */
type ContentRow = {
  id: string;
  type_id: string;
  title: string;
  slug: string;
  status: ContentStatus;
  excerpt: string;
  body: string;
  blocks: string;
  data: string;
  tags_json?: string;
  cover_id: string | null;
  seo_title: string;
  seo_description: string;
  lang: string;
  translation_of: string | null;
  author_id: string | null;
  author_name?: string | null;
  published_at: number | null;
  created_at: number;
  updated_at: number;
  prefix?: string;
};

const toContent = (r: ContentRow): Content => ({
  id: r.id,
  typeId: r.type_id,
  title: r.title,
  slug: r.slug,
  status: r.status,
  excerpt: r.excerpt,
  body: r.body,
  blocks: json<Block[]>(r.blocks, []),
  data: json<Record<string, unknown>>(r.data, {}),
  tags: json<Tag[]>(r.tags_json, []),
  coverId: r.cover_id,
  seoTitle: r.seo_title,
  seoDescription: r.seo_description,
  lang: r.lang ?? "",
  translationOf: r.translation_of ?? null,
  authorId: r.author_id,
  authorName: r.author_name ?? undefined,
  publishedAt: r.published_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const urlFor = (
  prefix: string | undefined,
  slug: string,
  homeId?: string,
  id?: string,
) => {
  if (homeId && id === homeId) return "/";
  return prefix ? `/${prefix}/${slug}` : `/${slug}`;
};

/** Adresse publique : les traductions sont préfixées par leur langue (/en/…). */
export function pathOf(
  r: {
    id: string;
    slug: string;
    prefix?: string;
    lang?: string;
    translation_of?: string | null;
  },
  homeId?: string,
) {
  const home =
    !!homeId && (r.id === homeId || (!!r.lang && r.translation_of === homeId));
  const base = home ? "/" : urlFor(r.prefix, r.slug);
  if (!r.lang) return base;
  return base === "/" ? `/${r.lang}` : `/${r.lang}${base}`;
}

const TAGS_JSON = `(SELECT json_group_array(json_object('id', tg.id, 'name', tg.name, 'slug', tg.slug))
  FROM (SELECT t2.* FROM content_tags ct JOIN tags t2 ON t2.id = ct.tag_id WHERE ct.content_id = c.id ORDER BY t2.name COLLATE NOCASE) tg) AS tags_json`;

const SELECT_CONTENT = `SELECT c.*, u.name AS author_name, t.prefix AS prefix, ${TAGS_JSON} FROM contents c
  JOIN content_types t ON t.id = c.type_id LEFT JOIN users u ON u.id = c.author_id`;

export type ContentFilter = {
  typeId?: string;
  status?: ContentStatus;
  q?: string;
  authorId?: string;
  tagId?: string;
  /** Langue : vide pour la principale, non défini pour toutes. */
  lang?: string;
  sort?: "updated" | "published" | "title";
  limit?: number;
  offset?: number;
};

export function listContents(filter: ContentFilter = {}): {
  items: ContentSummary[];
  total: number;
} {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (filter.typeId) {
    where.push("c.type_id = ?");
    params.push(filter.typeId);
  }
  if (filter.status) {
    where.push("c.status = ?");
    params.push(filter.status);
  }
  if (filter.authorId) {
    where.push("c.author_id = ?");
    params.push(filter.authorId);
  }
  if (filter.tagId) {
    where.push(
      "c.id IN (SELECT content_id FROM content_tags WHERE tag_id = ?)",
    );
    params.push(filter.tagId);
  }
  if (filter.lang !== undefined) {
    where.push("c.lang = ?");
    params.push(filter.lang);
  }
  if (filter.q) {
    where.push("(c.title LIKE ? OR c.slug LIKE ? OR c.excerpt LIKE ?)");
    const like = `%${filter.q.replace(/[%_]/g, "")}%`;
    params.push(like, like, like);
  }
  const clause = where.length ? ` WHERE ${where.join(" AND ")}` : "";
  const order =
    filter.sort === "title"
      ? "c.title COLLATE NOCASE"
      : filter.sort === "published"
        ? "c.published_at DESC"
        : "c.updated_at DESC";
  const total =
    db().get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM contents c${clause}`,
      ...params,
    )?.n ?? 0;
  const homeId = getIdentity().homeId;
  const rows = db().all<ContentRow>(
    `${SELECT_CONTENT}${clause} ORDER BY ${order} LIMIT ? OFFSET ?`,
    ...params,
    filter.limit ?? 50,
    filter.offset ?? 0,
  );
  return { items: rows.map((r) => summary(r, homeId)), total };
}

const summary = (r: ContentRow, homeId?: string): ContentSummary => ({
  id: r.id,
  typeId: r.type_id,
  title: r.title,
  slug: r.slug,
  status: r.status,
  excerpt: r.excerpt,
  coverId: r.cover_id,
  publishedAt: r.published_at,
  updatedAt: r.updated_at,
  authorName: r.author_name ?? undefined,
  lang: r.lang ?? "",
  translationOf: r.translation_of ?? null,
  tags: json<Tag[]>(r.tags_json, []),
  url: pathOf(r, homeId),
});

/** Contenus publiés, filtrés par type (vide = tous) et par tag. */
export function publishedOfType(
  typeId: string,
  limit: number,
  tagId?: string,
  lang = "",
): ContentSummary[] {
  const homeId = getIdentity().homeId;
  const where = ["c.status = 'published'", "c.lang = ?"];
  const params: (string | number)[] = [lang];
  if (typeId) {
    where.push("c.type_id = ?");
    params.push(typeId);
  }
  if (tagId) {
    where.push(
      "c.id IN (SELECT content_id FROM content_tags WHERE tag_id = ?)",
    );
    params.push(tagId);
  }
  return db()
    .all<ContentRow>(
      `${SELECT_CONTENT} WHERE ${where.join(" AND ")} ORDER BY c.published_at DESC LIMIT ?`,
      ...params,
      limit,
    )
    .map((r) => summary(r, homeId));
}

export const getContent = (id: string) => {
  const row = db().get<ContentRow>(`${SELECT_CONTENT} WHERE c.id = ?`, id);
  return row ? toContent(row) : undefined;
};

export const contentBySlug = (typeId: string, slug: string, lang = "") => {
  const row = db().get<ContentRow>(
    `${SELECT_CONTENT} WHERE c.type_id = ? AND c.slug = ? AND c.lang = ?`,
    typeId,
    slug,
    lang,
  );
  return row ? toContent(row) : undefined;
};

type PathRow = {
  id: string;
  slug: string;
  prefix: string;
  lang: string;
  translation_of: string | null;
  status: ContentStatus;
  title: string;
};
const PATH_SELECT =
  "SELECT c.id, c.slug, c.lang, c.translation_of, c.status, c.title, t.prefix FROM contents c JOIN content_types t ON t.id = c.type_id";

export function contentPath(id: string): string | undefined {
  const row = db().get<PathRow>(`${PATH_SELECT} WHERE c.id = ?`, id);
  return row ? pathOf(row, getIdentity().homeId) : undefined;
}

/** Toutes les versions linguistiques d'un contenu, lui compris. */
export function translationsOf(id: string): Translation[] {
  const homeId = getIdentity().homeId;
  return db()
    .all<PathRow>(
      `${PATH_SELECT} WHERE COALESCE(c.translation_of, c.id) = (SELECT COALESCE(translation_of, id) FROM contents WHERE id = ?) ORDER BY c.lang`,
      id,
    )
    .map((r) => ({
      id: r.id,
      lang: r.lang,
      title: r.title,
      status: r.status,
      url: pathOf(r, homeId),
    }));
}

/** Version d'un contenu dans une langue donnée, si elle existe. */
export const translationIn = (id: string, lang: string) =>
  translationsOf(id).find((t) => t.lang === lang);

export function uniqueSlug(
  typeId: string,
  base: string,
  exceptId?: string,
  lang = "",
) {
  const root = base || "sans-titre";
  let slug = root;
  for (
    let i = 2;
    db().get(
      "SELECT 1 FROM contents WHERE type_id = ? AND lang = ? AND slug = ? AND id <> ?",
      typeId,
      lang,
      slug,
      exceptId ?? "",
    );
    i++
  ) {
    slug = `${root}-${i}`;
  }
  return slug;
}

export type ContentInput = Partial<
  Omit<Content, "id" | "createdAt" | "updatedAt" | "authorName" | "tags">
> & { tags?: string[] };

export function saveContent(
  id: string | undefined,
  input: ContentInput,
  authorId?: string,
): Content {
  const existing = id ? getContent(id) : undefined;
  const oldPath =
    existing?.status === "published" ? contentPath(existing.id) : undefined;
  const t = now();
  const merged = { ...existing, ...input } as Content;
  // Un identifiant inconnu est conservé : restauration d'un contenu supprimé.
  const nextId = existing?.id ?? id ?? uid();
  const keptDate =
    existing?.status === "published" ? existing.publishedAt : null;
  const publishedAt =
    merged.status === "published"
      ? (input.publishedAt ?? keptDate ?? t)
      : (existing?.publishedAt ?? null);
  db().run(
    `INSERT INTO contents (id, type_id, title, slug, status, excerpt, body, blocks, data, cover_id, seo_title, seo_description, lang, translation_of, author_id, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET type_id = excluded.type_id, title = excluded.title, slug = excluded.slug, status = excluded.status,
     excerpt = excluded.excerpt, body = excluded.body, blocks = excluded.blocks, data = excluded.data, cover_id = excluded.cover_id, seo_title = excluded.seo_title,
     seo_description = excluded.seo_description, lang = excluded.lang, translation_of = excluded.translation_of,
     published_at = excluded.published_at, updated_at = excluded.updated_at`,
    nextId,
    merged.typeId,
    merged.title ?? "Sans titre",
    merged.slug,
    merged.status ?? "draft",
    merged.excerpt ?? "",
    merged.body ?? "",
    JSON.stringify(merged.blocks ?? []),
    JSON.stringify(merged.data ?? {}),
    merged.coverId ?? null,
    merged.seoTitle ?? "",
    merged.seoDescription ?? "",
    merged.lang ?? "",
    merged.translationOf ?? null,
    existing?.authorId ?? authorId ?? null,
    publishedAt,
    existing?.createdAt ?? t,
    t,
  );
  if (input.tags) setContentTags(nextId, ensureTags(input.tags));
  const newPath = contentPath(nextId);
  if (newPath) db().run("DELETE FROM redirects WHERE path = ?", newPath);
  if (oldPath && newPath && oldPath !== newPath && oldPath !== "/") {
    db().run(
      "INSERT INTO redirects (path, content_id, created_at) VALUES (?, ?, ?) ON CONFLICT(path) DO UPDATE SET content_id = excluded.content_id",
      oldPath,
      nextId,
      t,
    );
  }
  bumpVersion();
  const saved = getContent(nextId) as Content;
  recordRevision(
    "content",
    nextId,
    existing ? "update" : "create",
    saved,
    saved.title,
  );
  return saved;
}

/* Redirections : une ancienne adresse mène au contenu renommé. */
export const redirectFor = (path: string) =>
  db().get<{ content_id: string }>(
    "SELECT content_id FROM redirects WHERE path = ?",
    path,
  )?.content_id;

/* Tags */
export function listTags(): Tag[] {
  return db().all<Tag>(
    `SELECT t.id, t.name, t.slug, (SELECT COUNT(*) FROM content_tags ct WHERE ct.tag_id = t.id) AS count
     FROM tags t ORDER BY t.name COLLATE NOCASE`,
  );
}

export const getTag = (id: string) =>
  db().get<Tag>("SELECT id, name, slug FROM tags WHERE id = ?", id);
export const tagBySlug = (slug: string) =>
  db().get<Tag>("SELECT id, name, slug FROM tags WHERE slug = ?", slug);

function uniqueTagSlug(base: string, exceptId = "") {
  const root = slugify(base) || "tag";
  let slug = root;
  for (
    let i = 2;
    db().get("SELECT 1 FROM tags WHERE slug = ? AND id <> ?", slug, exceptId);
    i++
  )
    slug = `${root}-${i}`;
  return slug;
}

/** Retrouve les tags par nom (insensible à la casse) et crée les manquants. */
export function ensureTags(names: string[]): string[] {
  const ids: string[] = [];
  for (const raw of names) {
    const name = raw.trim().slice(0, 60);
    if (!name) continue;
    const found = db().get<{ id: string }>(
      "SELECT id FROM tags WHERE name = ? COLLATE NOCASE",
      name,
    );
    if (found) {
      ids.push(found.id);
      continue;
    }
    const id = uid();
    db().run(
      "INSERT INTO tags (id, name, slug, created_at) VALUES (?, ?, ?, ?)",
      id,
      name,
      uniqueTagSlug(name),
      now(),
    );
    recordRevision("tag", id, "create", getTag(id), name);
    ids.push(id);
  }
  return [...new Set(ids)];
}

export function setContentTags(contentId: string, tagIds: string[]) {
  db().tx(() => {
    db().run("DELETE FROM content_tags WHERE content_id = ?", contentId);
    for (const tagId of tagIds)
      db().run(
        "INSERT OR IGNORE INTO content_tags (content_id, tag_id) VALUES (?, ?)",
        contentId,
        tagId,
      );
  });
}

export function updateTag(id: string, patch: { name?: string; slug?: string }) {
  const current = getTag(id);
  if (!current) return undefined;
  const slug =
    patch.slug !== undefined
      ? uniqueTagSlug(patch.slug || patch.name || current.name, id)
      : current.slug;
  db().run(
    "UPDATE tags SET name = ?, slug = ? WHERE id = ?",
    patch.name?.trim() || current.name,
    slug,
    id,
  );
  bumpVersion();
  const saved = getTag(id);
  if (saved) recordRevision("tag", id, "update", tagSnapshot(id), saved.name);
  return saved;
}

/** État d'un tag avec ses contenus : sa restauration les retague. */
function tagSnapshot(id: string) {
  const tag = getTag(id);
  return {
    ...tag,
    contentIds: db()
      .all<{ content_id: string }>(
        "SELECT content_id FROM content_tags WHERE tag_id = ? ORDER BY content_id",
        id,
      )
      .map((r) => r.content_id),
  };
}

/** Recrée un tag supprimé avec son identifiant, et le rattache à ses contenus encore présents. */
export function restoreTag(snapshot: {
  id: string;
  name: string;
  slug: string;
  contentIds?: string[];
}) {
  if (!getTag(snapshot.id))
    db().run(
      "INSERT INTO tags (id, name, slug, created_at) VALUES (?, ?, ?, ?)",
      snapshot.id,
      snapshot.name,
      uniqueTagSlug(snapshot.slug || snapshot.name, snapshot.id),
      now(),
    );
  for (const contentId of snapshot.contentIds ?? [])
    db().run(
      "INSERT OR IGNORE INTO content_tags (content_id, tag_id) SELECT id, ? FROM contents WHERE id = ?",
      snapshot.id,
      contentId,
    );
  return updateTag(snapshot.id, { name: snapshot.name, slug: snapshot.slug });
}

export function deleteTag(id: string) {
  const snapshot = tagSnapshot(id);
  const { changes } = db().run("DELETE FROM tags WHERE id = ?", id);
  if (changes) recordRevision("tag", id, "delete", snapshot, snapshot.name);
  bumpVersion();
}

export function deleteContent(id: string) {
  // Les traductions d'un contenu supprimé deviennent indépendantes.
  db().run(
    "UPDATE contents SET translation_of = NULL WHERE translation_of = ?",
    id,
  );
  const current = getContent(id);
  const { changes } = db().run("DELETE FROM contents WHERE id = ?", id);
  if (current) recordRevision("content", id, "delete", current, current.title);
  bumpVersion();
  return changes > 0;
}

/* Menus */
type MenuRow = { id: string; name: string; items: string };
const toMenu = (r: MenuRow): Menu => ({
  id: r.id,
  name: r.name,
  items: json(r.items, []),
});
export const listMenus = () =>
  db().all<MenuRow>("SELECT * FROM menus ORDER BY name").map(toMenu);
export const getMenu = (id: string) => {
  const row = db().get<MenuRow>("SELECT * FROM menus WHERE id = ?", id);
  return row ? toMenu(row) : undefined;
};
export function saveMenu(input: Menu) {
  const t = now();
  const existed = !!getMenu(input.id);
  db().run(
    "INSERT INTO menus (id, name, items, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, items = excluded.items, updated_at = excluded.updated_at",
    input.id,
    input.name,
    JSON.stringify(input.items),
    t,
    t,
  );
  bumpVersion();
  const saved = getMenu(input.id) as Menu;
  recordRevision(
    "menu",
    saved.id,
    existed ? "update" : "create",
    saved,
    saved.name,
  );
  return saved;
}
export function deleteMenu(id: string) {
  const current = getMenu(id);
  db().run("DELETE FROM menus WHERE id = ?", id);
  if (current) recordRevision("menu", id, "delete", current, current.name);
  bumpVersion();
}

/* Médias */
type MediaRow = {
  id: string;
  name: string;
  mime: string;
  ext: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string;
  variants: string;
  created_at: number;
};
const toMedia = (r: MediaRow): MediaInfo => ({
  id: r.id,
  name: r.name,
  mime: r.mime,
  ext: r.ext,
  size: r.size,
  width: r.width,
  height: r.height,
  alt: r.alt,
  variants: json(r.variants, []),
  createdAt: r.created_at,
});

export function listMedia(
  filter: {
    q?: string;
    kind?: "image" | "file";
    limit?: number;
    offset?: number;
  } = {},
) {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (filter.q) {
    where.push("(name LIKE ? OR alt LIKE ?)");
    params.push(`%${filter.q}%`, `%${filter.q}%`);
  }
  if (filter.kind === "image") where.push("mime LIKE 'image/%'");
  if (filter.kind === "file") where.push("mime NOT LIKE 'image/%'");
  const clause = where.length ? ` WHERE ${where.join(" AND ")}` : "";
  const total =
    db().get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM media${clause}`,
      ...params,
    )?.n ?? 0;
  const items = db()
    .all<MediaRow>(
      `SELECT * FROM media${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      ...params,
      filter.limit ?? 60,
      filter.offset ?? 0,
    )
    .map(toMedia);
  return { items, total };
}

export const getMedia = (id: string) => {
  const row = db().get<MediaRow>("SELECT * FROM media WHERE id = ?", id);
  return row ? toMedia(row) : undefined;
};

export function insertMedia(media: MediaInfo) {
  db().run(
    "INSERT INTO media (id, name, mime, ext, size, width, height, alt, variants, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    media.id,
    media.name,
    media.mime,
    media.ext,
    media.size,
    media.width,
    media.height,
    media.alt,
    JSON.stringify(media.variants),
    media.createdAt,
  );
  bumpVersion();
  recordRevision("media", media.id, "create", media, media.name);
  return media;
}

export function updateMedia(
  id: string,
  patch: { alt?: string; name?: string },
) {
  const current = getMedia(id);
  if (!current) return undefined;
  db().run(
    "UPDATE media SET alt = ?, name = ? WHERE id = ?",
    patch.alt ?? current.alt,
    patch.name ?? current.name,
    id,
  );
  bumpVersion();
  const saved = getMedia(id);
  if (saved) recordRevision("media", id, "update", saved, saved.name);
  return saved;
}

export function deleteMediaRow(id: string) {
  const current = getMedia(id);
  db().run("DELETE FROM media WHERE id = ?", id);
  if (current) recordRevision("media", id, "delete", current, current.name);
  bumpVersion();
}

/* Tous les ids de médias référencés : utile pour le rendu groupé. */
export function mediaMap(): Map<string, MediaInfo> {
  return new Map(
    db()
      .all<MediaRow>("SELECT * FROM media")
      .map((r) => [r.id, toMedia(r)]),
  );
}
