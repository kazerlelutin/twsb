import type { Block } from "../blocks/block.type";
import { BLOCKS } from "../blocks/catalog";
import type { Layout } from "../site/site.type";
import { mediaUrl, type RenderContext, renderBlocks } from "./blocks.render";
import { EDITOR_FRAME_CSS, editorFrameScript } from "./editor-frame";
import { attrs, color, esc } from "./html";
import { BASE_CSS, fontPreloads, SITE_SCRIPT, themeCss } from "./theme";

const BLOCK_NAMES = Object.fromEntries(BLOCKS.map((b) => [b.type, b.label]));

export type DocumentInput = {
  ctx: RenderContext;
  layout?: Layout;
  main: Block[];
  title: string;
  description?: string;
  ogImageId?: string | null;
  canonical?: string;
  noindex?: boolean;
  /** Langue de la page (attribut lang) et versions dans d'autres langues. */
  lang?: string;
  alternates?: { lang: string; url: string }[];
  /** Aperçu de l'éditeur : zone modifiable (contenu de la page ou en-tête et pied). */
  editable?: "main" | "layout";
};

export function pageTitle(template: string, title: string, site: string) {
  if (!title || title === site) return site;
  return (template || "%s | %site").replace("%s", title).replace("%site", site);
}

/** Rend une page complète : identité, layout, contenu, CSS par bloc. */
export function renderDocument(input: DocumentInput): string {
  const { ctx, layout } = input;
  const identity = ctx.identity;
  const editMain = input.editable === "main";
  const editLayout = input.editable === "layout";
  const main = renderBlocks(
    { ...ctx, editor: editMain, css: ctx.css },
    input.main,
  );
  const header = layout
    ? renderBlocks({ ...ctx, editor: editLayout, css: ctx.css }, layout.header)
    : "";
  const footer = layout
    ? renderBlocks({ ...ctx, editor: editLayout, css: ctx.css }, layout.footer)
    : "";
  const zone = (name: string, on: boolean) =>
    on ? ` data-ws-zone="${name}"` : "";
  const headerStyle = color(layout?.options.headerBackground)
    ? ` style="background:${color(layout?.options.headerBackground)}"`
    : "";
  const footerStyle = color(layout?.options.footerBackground)
    ? ` style="background:${color(layout?.options.footerBackground)}"`
    : "";
  const favicon = identity.faviconId
    ? ctx.media(identity.faviconId)
    : undefined;
  const og = input.ogImageId
    ? ctx.media(input.ogImageId)
    : identity.ogImageId
      ? ctx.media(identity.ogImageId)
      : undefined;
  const description = input.description || identity.description;
  const fullTitle = pageTitle(
    identity.titleTemplate,
    input.title,
    identity.name,
  );
  const meta = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${esc(fullTitle)}</title>`,
    fontPreloads(identity),
    description &&
      `<meta name="description"${attrs({ content: description })}>`,
    input.noindex && `<meta name="robots" content="noindex">`,
    input.canonical &&
      `<link rel="canonical"${attrs({ href: input.canonical })}>`,
    ...(input.alternates && input.alternates.length > 1
      ? input.alternates.map(
          (a) =>
            `<link rel="alternate"${attrs({ hreflang: a.lang, href: a.url })}>`,
        )
      : []),
    `<meta property="og:title"${attrs({ content: fullTitle })}>`,
    `<meta property="og:site_name"${attrs({ content: identity.name })}>`,
    description &&
      `<meta property="og:description"${attrs({ content: description })}>`,
    og &&
      `<meta property="og:image"${attrs({ content: mediaUrl(og, og.variants.find((v) => v.width >= 1200)?.file) })}>`,
    `<meta name="theme-color"${attrs({ content: color(identity.colors.primary) })}>`,
    favicon
      ? `<link rel="icon" href="/favicon.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png">`
      : "",
  ]
    .filter(Boolean)
    .join("");
  const editing = !!input.editable;
  const css = `${themeCss(identity)}\n${BASE_CSS}\n${ctx.css.join("\n")}${editing ? `\n${EDITOR_FRAME_CSS}` : ""}`;
  const script = editing
    ? `${SITE_SCRIPT}${editorFrameScript(BLOCK_NAMES)}`
    : SITE_SCRIPT;
  const headerTag =
    header || editLayout
      ? `<header class="ws-header${layout?.options.stickyHeader && !editing ? " ws-header--sticky" : ""}"${headerStyle}${zone("header", editLayout)}>${header}</header>`
      : "";
  const footerTag =
    footer || editLayout
      ? `<footer class="ws-footer"${footerStyle}${zone("footer", editLayout)}>${footer}</footer>`
      : "";
  const body = `${headerTag}<main id="main" class="ws-main"${zone("main", editMain)}>${main}</main>${footerTag}`;
  return `<!doctype html><html lang="${esc(input.lang || identity.lang || "fr")}"><head>${meta}<style>${css}</style></head><body class="ws-site"><a class="ws-skip" href="#main">Aller au contenu</a>${body}<script>${script}</script></body></html>`;
}
