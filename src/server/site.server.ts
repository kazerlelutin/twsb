import type { Block } from "../features/blocks/block.type";
import { blockId, createBlock } from "../features/blocks/catalog";
import { walk } from "../features/blocks/tree.service";
import type { RenderContext } from "../features/render/blocks.render";
import { esc } from "../features/render/html";
import { renderDocument } from "../features/render/page.render";
import {
  type Content,
  type ContentType,
  type Identity,
  LANGUAGE_NAMES,
  type Layout,
  type Tag,
} from "../features/site/site.type";
import { config } from "./config.server";
import { db } from "./db.server";
import {
  contentBySlug,
  contentPath,
  defaultLayout,
  getContent,
  getIdentity,
  getLayout,
  getMenu,
  getPlugins,
  getType,
  listTypes,
  mediaMap,
  pathOf,
  publishedOfType,
  publishedPage,
  redirectFor,
  siteVersion,
  tagBySlug,
  translationIn,
  translationsOf,
  typeByPrefix,
} from "./repo.server";
import "./seed.server";

export type SiteResponse = { status: number; html: string; location?: string };

export const TAG_PREFIX = "tag";
const langPrefix = (lang = "") => (lang ? `/${lang}` : "");
export const tagUrl = (tag: Pick<Tag, "slug">, lang = "") =>
  `${langPrefix(lang)}/${TAG_PREFIX}/${tag.slug}`;

type ContextOptions = { editor?: boolean; currentPath?: string; lang?: string };

/** Langues du site : principale puis secondaires, si l'extension est active. */
export function siteLanguages(identity = getIdentity()) {
  const { i18n } = getPlugins();
  const main = identity.lang.split("-")[0] || "fr";
  const mainLabel = LANGUAGE_NAMES[main] ?? main.toUpperCase();
  if (!i18n.enabled)
    return [{ code: "", tag: identity.lang, label: mainLabel }];
  return [
    { code: "", tag: identity.lang, label: mainLabel },
    ...i18n.languages.map((l) => ({
      code: l.code,
      tag: l.code,
      label: l.label,
    })),
  ];
}

export function renderContext(
  identity: Identity,
  options: ContextOptions = {},
): RenderContext {
  const media = mediaMap();
  const lang = options.lang ?? "";
  return {
    identity,
    media: (id) => media.get(id),
    menu: (id) => getMenu(id),
    posts: (typeId, limit, tagId) =>
      publishedOfType(typeId, Math.min(50, Math.max(1, limit)), tagId, lang),
    postsPage: (query) => publishedPage({ ...query, lang }),
    tagUrl: (tag) => tagUrl(tag, lang),
    // Un lien vers un contenu mène à sa traduction dans la langue de la page.
    contentUrl: (id) => {
      const translated = lang ? translationIn(id, lang) : undefined;
      return translated?.status === "published"
        ? translated.url
        : contentPath(id);
    },
    homeUrl: langPrefix(lang) || "/",
    css: [],
    ...options,
    lang,
  };
}

/** Sélecteur de langue : traduction publiée du contenu, sinon accueil de la langue. */
function languageLinks(lang: string, contentId?: string) {
  const languages = siteLanguages();
  if (languages.length < 2) return [];
  const versions = contentId ? translationsOf(contentId) : [];
  return languages.map((l) => {
    const version = versions.find(
      (v) => v.lang === l.code && v.status === "published",
    );
    return {
      code: l.code || l.tag.split("-")[0],
      tag: l.tag,
      label: l.label,
      url: version?.url ?? (langPrefix(l.code) || "/"),
      current: l.code === lang,
      translated: !!version,
    };
  });
}

const section = (children: Block[]): Block => ({
  id: blockId(),
  type: "section",
  props: { width: "container" },
  children,
});

export const DEFAULT_TEMPLATE = (): Block[] => [
  section([
    { id: "t-cover", type: "content-cover", props: { fit: "21/9" } },
    { id: "t-title", type: "content-title", props: {} },
    {
      id: "t-meta",
      type: "content-meta",
      props: { showDate: true, showAuthor: true },
    },
    { id: "t-body", type: "content-body", props: {} },
  ]),
];

export const layoutFor = (type: ContentType | undefined): Layout | undefined =>
  (type?.layoutId ? getLayout(type.layoutId) : undefined) ?? defaultLayout();

export function renderContent(content: Content, options: ContextOptions = {}) {
  const type = getType(content.typeId);
  if (!type) return undefined;
  const identity = getIdentity();
  const ctx = renderContext(identity, { ...options, lang: content.lang });
  const languages = languageLinks(content.lang, content.id);
  ctx.languages = languages;
  ctx.content = {
    title: content.title,
    bodyHtml: content.body,
    coverId: content.coverId,
    publishedAt: content.publishedAt,
    authorName: content.authorName,
    data: content.data,
    fields: type.fields,
    tags: content.tags,
  };
  const path = contentPath(content.id);
  return renderDocument({
    ctx,
    layout: layoutFor(type),
    // Le type est la mise en page : le contenu ne fournit que les valeurs.
    main: type.template.length ? type.template : DEFAULT_TEMPLATE(),
    // Le titre et la description servent aussi au référencement.
    title: content.id === identity.homeId ? identity.name : content.title,
    description: content.excerpt || content.seoDescription,
    ogImageId: content.coverId,
    canonical: path ? `${config().publicUrl}${path}` : undefined,
    noindex: content.status !== "published",
    lang: languages.find((l) => l.current)?.tag,
    alternates: languages
      .filter((l) => l.translated)
      .map((l) => ({ lang: l.tag, url: `${config().publicUrl}${l.url}` })),
  });
}

/** Liste par défaut d'un type : titre, puis cartes paginées. */
export const DEFAULT_ARCHIVE = (): Block[] => [
  section([createBlock("archive-title"), createBlock("archive-list")]),
];

/** Réglages du bloc « Liste des contenus » d'un modèle de liste. */
function listSettings(blocks: Block[]) {
  let found: Block | undefined;
  walk(blocks, (b) => {
    if (!found && b.type === "archive-list") found = b;
  });
  return {
    perPage: Math.min(48, Math.max(1, Number(found?.props.perPage) || 12)),
    order: String(found?.props.order ?? "recent"),
  };
}

type ArchiveInput = {
  title: string;
  typeId: string;
  tagId?: string;
  layout?: Layout;
  lang?: string;
  page: number;
  basePath: string;
  template?: Block[];
  fields?: ContentType["fields"];
};

/** Page de liste d'un type ou d'un tag ; une page au-delà de la dernière n'existe pas. */
function renderArchive(archive: ArchiveInput, currentPath: string) {
  const identity = getIdentity();
  const lang = archive.lang ?? "";
  const main = archive.template?.length ? archive.template : DEFAULT_ARCHIVE();
  const { perPage, order } = listSettings(main);
  const { total } = publishedPage({
    typeId: archive.typeId,
    tagId: archive.tagId,
    page: 1,
    perPage: 1,
    order,
    lang,
  });
  if (archive.page > Math.max(1, Math.ceil(total / perPage))) return undefined;
  const ctx = renderContext(identity, { currentPath, lang });
  const languages = languageLinks(lang);
  ctx.languages = languages;
  ctx.archive = {
    title: archive.title,
    typeId: archive.typeId,
    tagId: archive.tagId,
    page: archive.page,
    basePath: archive.basePath,
    fields: archive.fields,
  };
  const path =
    archive.page > 1
      ? `${archive.basePath}/page/${archive.page}`
      : archive.basePath;
  return renderDocument({
    ctx,
    layout: archive.layout ?? defaultLayout(),
    main,
    title:
      archive.page > 1
        ? `${archive.title} | page ${archive.page}`
        : archive.title,
    canonical: `${config().publicUrl}${path}`,
    lang: languages.find((l) => l.current)?.tag,
  });
}

function renderNotFound(currentPath: string) {
  const identity = getIdentity();
  const main = [
    section([
      {
        id: "n-title",
        type: "heading",
        props: { text: "Page introuvable", level: "1", align: "center" },
      },
      {
        id: "n-home",
        type: "button",
        props: {
          label: "Retour à l'accueil",
          url: "/",
          align: "center",
          variant: "primary",
        },
      },
    ]),
  ];
  return renderDocument({
    ctx: renderContext(identity, { currentPath }),
    layout: layoutFor(getType("page")),
    main,
    title: "Page introuvable",
    noindex: true,
  });
}

/** Résout une URL publique vers son contenu publié. */
export function resolvePath(pathname: string): {
  content?: Content;
  archive?: ContentType;
  tag?: Tag;
  lang: string;
  page: number;
} {
  const resolved = resolveParts(
    decodeURIComponent(pathname).split("/").filter(Boolean),
  );
  return { page: 1, ...resolved };
}

/** Pages suivantes d'une liste : …/page/2 (la page 1 garde l'adresse de base). */
function pageSuffix(parts: string[]) {
  const n = parts.length;
  if (n >= 3 && parts[n - 2] === "page" && /^[1-9]\d{0,4}$/.test(parts[n - 1]))
    return { parts: parts.slice(0, -2), page: Number(parts[n - 1]) };
  return undefined;
}

function resolveParts(input: string[]): {
  content?: Content;
  archive?: ContentType;
  tag?: Tag;
  lang: string;
  page?: number;
} {
  const parts = [...input];
  const paged = pageSuffix(parts.slice(lang0(parts)));
  if (paged && paged.page > 1) {
    const lang = lang0(parts) ? (parts[0] as string) : "";
    const base = paged.parts;
    if (base.length === 1) {
      const archive = typeByPrefix(base[0]);
      if (archive) return { archive, lang, page: paged.page };
    }
    if (base.length === 2 && base[0] === TAG_PREFIX) {
      const tag = tagBySlug(base[1]);
      if (tag) return { tag, lang, page: paged.page };
    }
    return { lang };
  }
  // Premier segment = code d'une langue secondaire active : /en/…
  const lang = siteLanguages().some((l) => l.code && l.code === parts[0])
    ? (parts.shift() as string)
    : "";
  const published = (c: Content | undefined) =>
    c?.status === "published" ? c : undefined;
  if (parts.length === 0) {
    const home = getIdentity().homeId;
    if (!home) return { lang };
    const id = lang ? translationIn(home, lang)?.id : home;
    return { content: published(id ? getContent(id) : undefined), lang };
  }
  if (parts.length === 1) {
    const page = listTypes()
      .filter((t) => t.prefix === "")
      .map((t) => contentBySlug(t.id, parts[0], lang))
      .find((c) => c?.status === "published");
    if (page) return { content: page, lang };
    const archive = typeByPrefix(parts[0]);
    return archive ? { archive, lang } : { lang };
  }
  if (parts.length === 2 && parts[0] === TAG_PREFIX) {
    const tag = tagBySlug(parts[1]);
    return tag ? { tag, lang } : { lang };
  }
  if (parts.length === 2) {
    const type = typeByPrefix(parts[0]);
    const content = type ? contentBySlug(type.id, parts[1], lang) : undefined;
    return { content: published(content), lang };
  }
  return { lang };
}

/** 1 si le premier segment est une langue secondaire active, sinon 0. */
const lang0 = (parts: string[]) =>
  siteLanguages().some((l) => l.code && l.code === parts[0]) ? 1 : 0;

const cache = new Map<string, { version: number; response: SiteResponse }>();
const CACHE_MAX = 500;

/** Rendu public avec cache mémoire invalidé à chaque écriture. */
export function renderPublic(pathname: string): SiteResponse {
  const key = pathname.replace(/\/+$/, "") || "/";
  const hit = cache.get(key);
  if (hit && hit.version === siteVersion()) return hit.response;
  const { content, archive, tag, lang, page } = resolvePath(key);
  const prefix = lang ? `/${lang}` : "";
  const archiveHtml = archive
    ? renderArchive(
        {
          title: archive.name,
          typeId: archive.id,
          layout: layoutFor(archive),
          lang,
          page,
          basePath: `${prefix}/${archive.prefix}`,
          template: archive.archiveTemplate,
          fields: archive.fields,
        },
        key,
      )
    : tag
      ? renderArchive(
          {
            title: tag.name,
            typeId: "",
            tagId: tag.id,
            lang,
            page,
            basePath: tagUrl(tag, lang),
          },
          key,
        )
      : undefined;
  const moved = !content && !archive && !tag ? redirectFor(key) : undefined;
  const target = moved ? getContent(moved) : undefined;
  const location =
    target?.status === "published" ? contentPath(target.id) : undefined;
  const response: SiteResponse = content
    ? { status: 200, html: renderContent(content, { currentPath: key }) ?? "" }
    : archiveHtml
      ? { status: 200, html: archiveHtml }
      : location
        ? { status: 301, html: "", location }
        : { status: 404, html: renderNotFound(key) };
  if (cache.size >= CACHE_MAX)
    cache.delete(cache.keys().next().value as string);
  cache.set(key, { version: siteVersion(), response });
  return response;
}

export const clearCache = () => cache.clear();

export function sitemap() {
  const base = config().publicUrl;
  const homeId = getIdentity().homeId;
  const langs = new Set(siteLanguages().map((l) => l.code));
  const rows = db()
    .all<{
      id: string;
      slug: string;
      prefix: string;
      lang: string;
      translation_of: string | null;
      updated_at: number;
    }>(
      "SELECT c.id, c.slug, t.prefix, c.lang, c.translation_of, c.updated_at FROM contents c JOIN content_types t ON t.id = c.type_id WHERE c.status = 'published'",
    )
    .filter((r) => langs.has(r.lang));
  const urls = rows.map((r) => {
    const loc = pathOf(r, homeId);
    return `<url><loc>${esc(base + loc)}</loc><lastmod>${new Date(r.updated_at).toISOString()}</lastmod></url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`;
}

export const robots = () =>
  `User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${config().publicUrl}/sitemap.xml\n`;
