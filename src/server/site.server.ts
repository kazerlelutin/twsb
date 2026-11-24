import type { Block } from "../features/blocks/block.type";
import { blockId } from "../features/blocks/catalog";
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
import { db } from "./db.server";
import { env } from "./env.server";
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

/** Blocs principaux d'un contenu selon le mode d'édition de son type. */
export function mainBlocks(type: ContentType, content: Content): Block[] {
  if (type.editor === "builder") return content.blocks;
  return type.template.length ? type.template : DEFAULT_TEMPLATE();
}

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
    main: mainBlocks(type, content),
    // Le titre et la description servent aussi au référencement.
    title: content.id === identity.homeId ? identity.name : content.title,
    description: content.excerpt || content.seoDescription,
    ogImageId: content.coverId,
    canonical: path ? `${env().publicUrl}${path}` : undefined,
    noindex: content.status !== "published",
    lang: languages.find((l) => l.current)?.tag,
    alternates: languages
      .filter((l) => l.translated)
      .map((l) => ({ lang: l.tag, url: `${env().publicUrl}${l.url}` })),
  });
}

function renderArchive(
  archive: {
    title: string;
    typeId: string;
    tagId?: string;
    layout?: Layout;
    lang?: string;
  },
  currentPath: string,
) {
  const identity = getIdentity();
  const lang = archive.lang ?? "";
  const ctx = renderContext(identity, { currentPath, lang });
  const languages = languageLinks(lang);
  ctx.languages = languages;
  const main = [
    section([
      {
        id: "a-title",
        type: "heading",
        props: { text: archive.title, level: "1" },
      },
      {
        id: "a-list",
        type: "posts",
        props: {
          typeId: archive.typeId,
          tagId: archive.tagId ?? "",
          limit: 50,
          display: "list",
          showCover: true,
          showExcerpt: true,
          showDate: true,
        },
      },
    ]),
  ];
  return renderDocument({
    ctx,
    layout: archive.layout ?? defaultLayout(),
    main,
    title: archive.title,
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
} {
  const parts = decodeURIComponent(pathname).split("/").filter(Boolean);
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

const cache = new Map<string, { version: number; response: SiteResponse }>();
const CACHE_MAX = 500;

/** Rendu public avec cache mémoire invalidé à chaque écriture. */
export function renderPublic(pathname: string): SiteResponse {
  const key = pathname.replace(/\/+$/, "") || "/";
  const hit = cache.get(key);
  if (hit && hit.version === siteVersion()) return hit.response;
  const { content, archive, tag, lang } = resolvePath(key);
  const moved = !content && !archive && !tag ? redirectFor(key) : undefined;
  const target = moved ? getContent(moved) : undefined;
  const location =
    target?.status === "published" ? contentPath(target.id) : undefined;
  const response: SiteResponse = content
    ? { status: 200, html: renderContent(content, { currentPath: key }) ?? "" }
    : archive
      ? {
          status: 200,
          html: renderArchive(
            {
              title: archive.name,
              typeId: archive.id,
              layout: layoutFor(archive),
              lang,
            },
            key,
          ),
        }
      : tag
        ? {
            status: 200,
            html: renderArchive(
              { title: tag.name, typeId: "", tagId: tag.id, lang },
              key,
            ),
          }
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
  const base = env().publicUrl;
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
  `User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${env().publicUrl}/sitemap.xml\n`;
