import type { Block, BlockStyle, Spacing } from "../blocks/block.type";
import {
  blockDef,
  fieldKind,
  isFieldBlock,
  ratioParts,
} from "../blocks/catalog";
import {
  CONTENT_FIELD_TYPES,
  type ContentField,
  type ContentSummary,
  type Identity,
  type MediaInfo,
  type Menu,
  type MenuItem,
  type Tag,
} from "../site/site.type";
import { attrs, bool, color, esc, num, safeUrl, str } from "./html";

export type RenderContext = {
  identity: Identity;
  media: (id: string) => MediaInfo | undefined;
  menu: (id: string) => Menu | undefined;
  posts: (typeId: string, limit: number, tagId?: string) => ContentSummary[];
  contentUrl: (id: string) => string | undefined;
  tagUrl?: (tag: Pick<Tag, "slug">) => string;
  content?: {
    title: string;
    bodyHtml: string;
    coverId: string | null;
    publishedAt: number | null;
    authorName?: string;
    data?: Record<string, unknown>;
    fields?: ContentField[];
    tags?: Tag[];
    excerpt?: string;
    /** Présent dans une carte de liste : le titre devient un lien vers le contenu. */
    url?: string;
  };
  /** Page de liste d'un type (ou d'un tag) : titre, page courante, adresse de base. */
  archive?: {
    title: string;
    typeId: string;
    tagId?: string;
    page: number;
    basePath: string;
    fields?: ContentField[];
  };
  postsPage?: (query: {
    typeId: string;
    tagId?: string;
    page: number;
    perPage: number;
    order: string;
  }) => { items: ContentSummary[]; total: number };
  currentPath?: string;
  editor?: boolean;
  /** Langue de la page : vide pour la langue principale. */
  lang?: string;
  homeUrl?: string;
  languages?: {
    code: string;
    tag: string;
    label: string;
    url: string;
    current: boolean;
  }[];
  css: string[];
};

export const mediaUrl = (media: MediaInfo, file = `original.${media.ext}`) =>
  `/media/${media.id}/${file}`;

export function picture(
  ctx: RenderContext,
  id: unknown,
  options: {
    alt?: string;
    sizes?: string;
    eager?: boolean;
    className?: string;
    height?: number;
  } = {},
) {
  const media = typeof id === "string" && id ? ctx.media(id) : undefined;
  if (!media) return "";
  const alt = esc(options.alt ?? media.alt);
  const dims =
    media.width && media.height
      ? attrs({ width: media.width, height: media.height })
      : "";
  const style = options.height ? ` style="height:${options.height}px"` : "";
  const base = `${attrs({ class: options.className })} alt="${alt}"${dims}${style} ${
    options.eager ? 'fetchpriority="high"' : 'loading="lazy"'
  } decoding="async"`;
  const webp = media.variants
    .filter((v) => v.format === "webp")
    .sort((a, b) => a.width - b.width);
  if (!webp.length) return `<img src="${esc(mediaUrl(media))}"${base}>`;
  const srcset = webp
    .map((v) => `${mediaUrl(media, v.file)} ${v.width}w`)
    .join(", ");
  const sizes = options.sizes ?? "(max-width: 768px) 100vw, 1200px";
  return `<picture><source type="image/webp" srcset="${esc(srcset)}" sizes="${esc(sizes)}"><img src="${esc(mediaUrl(media))}"${base}></picture>`;
}

const px = (n: number | undefined) =>
  n === undefined || n === null || Number.isNaN(n) ? undefined : `${n}px`;

const spacing = (prop: string, value?: Spacing) => {
  if (!value) return "";
  return (["top", "right", "bottom", "left"] as const)
    .filter(
      (side) =>
        value[side] !== undefined &&
        value[side] !== null &&
        String(value[side]) !== "",
    )
    .map((side) => `${prop}-${side}:${num(value[side])}px`)
    .join(";");
};

export function styleCss(ctx: RenderContext, style: BlockStyle | undefined) {
  if (!style) return "";
  const rules: string[] = [];
  const add = (rule: string | undefined | false) => rule && rules.push(rule);
  add(spacing("padding", style.padding));
  add(spacing("margin", style.margin));
  if (color(style.background))
    add(`background-color:${color(style.background)}`);
  if (style.backgroundImage) {
    const media = ctx.media(style.backgroundImage);
    if (media) {
      const large = [...media.variants]
        .filter((v) => v.format === "webp")
        .sort((a, b) => b.width - a.width)[0];
      add(
        `background-image:url("${mediaUrl(media, large?.file)}");background-size:cover;background-position:center`,
      );
    }
  }
  if (color(style.color)) add(`color:${color(style.color)}`);
  if (style.align && ["left", "center", "right"].includes(style.align))
    add(`text-align:${style.align}`);
  if (style.fontSize) add(`font-size:${px(num(style.fontSize))}`);
  if (style.maxWidth)
    add(`max-width:${px(num(style.maxWidth))};margin-inline:auto;width:100%`);
  if (style.minHeight) add(`min-height:${px(num(style.minHeight))}`);
  if (style.radius !== undefined && String(style.radius) !== "")
    add(`border-radius:${px(num(style.radius))};overflow:hidden`);
  if (style.shadow === true) add("box-shadow:0 12px 32px rgb(0 0 0/.1)");
  if (style.shadow === false) add("box-shadow:none");
  return rules.join(";");
}

/** Le style ordinateur s'applique partout, le mobile le surcharge ; « masquer » vaut par appareil. */
function collectCss(ctx: RenderContext, block: Block) {
  const desktop = styleCss(ctx, block.style?.desktop);
  const mobile = styleCss(ctx, block.style?.mobile);
  const cls =
    block.type === "section" ? `.b-${block.id}>.ws-section` : `.b-${block.id}`;
  if (desktop) ctx.css.push(`${cls}{${desktop}}`);
  if (mobile) ctx.css.push(`@media (max-width:768px){${cls}{${mobile}}}`);
  if (block.style?.desktop?.hidden)
    ctx.css.push(`@media (min-width:769px){.b-${block.id}{display:none}}`);
  if (block.style?.mobile?.hidden)
    ctx.css.push(`@media (max-width:768px){.b-${block.id}{display:none}}`);
  const overlay = num(block.style?.desktop?.overlay);
  if (overlay > 0)
    ctx.css.push(`.b-${block.id} .ws-overlay{opacity:${overlay / 100}}`);
}

const children = (ctx: RenderContext, block: Block) =>
  (block.children ?? []).map((child) => renderBlock(ctx, child)).join("");

const alignStyle = (value: unknown) => {
  const a = str(value);
  return a === "center" || a === "right" ? `text-align:${a}` : "";
};

/** Marque un texte modifiable directement dans l'aperçu de l'éditeur. */
const ed = (ctx: RenderContext, path: string, rich = false) =>
  ctx.editor
    ? ` data-ws-edit="${esc(path)}"${rich ? " data-ws-rich" : ""}`
    : "";

const button = (
  ctx: RenderContext,
  label: unknown,
  url: unknown,
  path: string,
  variant = "primary",
  size = "md",
  newTab = false,
) => {
  const text = str(label);
  if (!text) return "";
  const href = safeUrl(url) || "#";
  return `<a class="ws-btn ws-btn--${esc(variant)} ws-btn--${esc(size)}" href="${esc(href)}"${
    newTab ? ' target="_blank" rel="noopener"' : ""
  }${ed(ctx, path)}>${esc(text)}</a>`;
};

const list = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value : [];

const aspect = (fit: unknown) => {
  const value = str(fit);
  return /^\d+\/\d+$/.test(value)
    ? `aspect-ratio:${value};overflow:hidden`
    : "";
};

function videoEmbed(url: string, title: string) {
  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/,
  );
  if (yt)
    return `<iframe src="https://www.youtube-nocookie.com/embed/${esc(yt[1])}" title="${esc(title)}" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo)
    return `<iframe src="https://player.vimeo.com/video/${esc(vimeo[1])}" title="${esc(title)}" allow="fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
  const safe = safeUrl(url);
  if (safe)
    return `<video src="${esc(safe)}" controls preload="metadata" title="${esc(title)}"></video>`;
  return "";
}

function menuItems(ctx: RenderContext, items: MenuItem[], sub = false): string {
  if (!items.length) return "";
  const li = items
    .map((item) => {
      const href = item.contentId
        ? ctx.contentUrl(item.contentId)
        : safeUrl(item.url);
      const current =
        href && ctx.currentPath === href ? ' aria-current="page"' : "";
      return `<li><a href="${esc(href || "#")}"${current}>${esc(item.label)}</a>${menuItems(ctx, item.children ?? [], true)}</li>`;
    })
    .join("");
  return `<ul class="${sub ? "ws-menu__sub" : "ws-menu__list"}"${sub ? "" : ' id="__ID__"'}>${li}</ul>`;
}

const BURGER =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';

const placeholder = (ctx: RenderContext, label: string) =>
  ctx.editor ? `<div class="ws-placeholder">${esc(label)}</div>` : "";

const dateFormat = (
  ctx: RenderContext,
  value: number | string | null | undefined,
) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(ctx.identity.lang || "fr", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
};

const tagLinks = (ctx: RenderContext, tags: Tag[] | undefined) =>
  (tags ?? [])
    .map(
      (t) =>
        `<a class="ws-tag" href="${esc(ctx.tagUrl?.(t) ?? `/tag/${t.slug}`)}">${esc(t.name)}</a>`,
    )
    .join("");

/** Sens des colonnes : ordinateur (normal / inversé), mobile (empilé / empilé inversé / côte à côte). */
function columnsClasses(p: Record<string, unknown>) {
  const mobile =
    str(p.mobile) ||
    (p.stack === false ? "row" : bool(p.reverse) ? "stack-reverse" : "stack");
  const desktop = str(p.desktop, "row");
  return [
    "ws-columns",
    `ws-columns--m-${mobile}`,
    desktop === "row-reverse" && "ws-columns--d-reverse",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Valeur d'un champ personnalisé, rendue selon son type. */
function fieldValue(
  ctx: RenderContext,
  field: ContentField,
  value: unknown,
  p: Record<string, unknown>,
) {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && !value.length)
  )
    return "";
  switch (field.type) {
    case "richtext":
      return `<div class="ws-prose">${str(value)}</div>`;
    case "textarea":
      return str(value).trimStart().startsWith("<")
        ? `<div class="ws-prose">${str(value)}</div>`
        : `<p>${esc(value).replaceAll("\n", "<br>")}</p>`;
    case "media":
      return picture(ctx, value);
    case "gallery":
      return `<div class="ws-grid ws-gallery" style="--cols:${num(p.columns, 3)};--cols-m:2;--gap:12px">${list(
        value,
      )
        .map(
          (id) =>
            `<div class="ws-fit" style="aspect-ratio:1/1;overflow:hidden">${picture(ctx, id, { sizes: "33vw" })}</div>`,
        )
        .join("")}</div>`;
    case "url": {
      const href = safeUrl(value);
      return href
        ? `<a class="ws-btn ws-btn--outline" href="${esc(href)}">${esc(str(p.linkLabel) || field.label)}</a>`
        : "";
    }
    case "email":
      return `<a href="mailto:${esc(value)}">${esc(value)}</a>`;
    case "date":
      return `<time datetime="${esc(value)}">${dateFormat(ctx, str(value))}</time>`;
    case "toggle":
      return value === true ? "Oui" : "Non";
    case "color":
      return `<span class="ws-swatch" style="background:${color(value)}"></span> ${esc(value)}`;
    default: {
      const level = Math.min(4, Math.max(0, num(p.level, 0)));
      return level
        ? `<h${level}>${esc(value)}</h${level}>`
        : `<p>${esc(value)}</p>`;
    }
  }
}

type Renderer = (
  ctx: RenderContext,
  block: Block,
  p: Record<string, unknown>,
) => string;

const RENDERERS: Record<string, Renderer> = {
  section: (ctx, block, p) => {
    const width = str(p.width, "container");
    const anchor = str(p.anchor).replace(/[^\w-]/g, "");
    const overlay =
      num(block.style?.desktop?.overlay) > 0
        ? '<div class="ws-overlay"></div>'
        : "";
    const inner =
      children(ctx, block) ||
      (ctx.editor ? '<div class="ws-dropzone"></div>' : "");
    return `<section class="ws-section"${anchor ? ` id="${anchor}"` : ""}>${overlay}<div class="ws-container ws-container--${esc(width)}">${inner}</div></section>`;
  },
  columns: (ctx, block, p) => {
    const template = ratioParts(p.ratio)
      .map((n) => `${n}fr`)
      .join(" ");
    const valign = str(p.valign, "start");
    return `<div class="${columnsClasses(p)}" style="grid-template-columns:${template};--gap:${num(p.gap, 32)}px;--valign:${esc(valign)}">${children(ctx, block)}</div>`;
  },
  column: (ctx, block) =>
    `<div class="ws-column">${children(ctx, block) || (ctx.editor ? '<div class="ws-dropzone"></div>' : "")}</div>`,
  heading: (ctx, _b, p) => {
    const level = Math.min(4, Math.max(1, num(p.level, 2)));
    return `<h${level} style="${alignStyle(p.align)}"${ed(ctx, "text")}>${esc(p.text)}</h${level}>`;
  },
  text: (ctx, _b, p) =>
    `<div class="ws-text" style="${alignStyle(p.align)}"${ed(ctx, "html", true)}>${str(p.html)}</div>`,
  button: (ctx, _b, p) =>
    `<div class="ws-actions" style="justify-content:${str(p.align) === "center" ? "center" : str(p.align) === "right" ? "flex-end" : "flex-start"}">${button(
      ctx,
      p.label,
      p.url,
      "label",
      str(p.variant, "primary"),
      str(p.size, "md"),
      bool(p.newTab),
    )}</div>`,
  image: (ctx, _b, p) => {
    const img = picture(ctx, p.media, { alt: str(p.alt) || undefined });
    if (!img) return placeholder(ctx, "Image");
    const href = safeUrl(p.url);
    const fit = aspect(p.fit);
    const body = `<div class="${fit ? "ws-fit" : ""}" style="${fit}">${href ? `<a href="${esc(href)}">${img}</a>` : img}</div>`;
    const caption = str(p.caption)
      ? `<figcaption${ed(ctx, "caption")}>${esc(p.caption)}</figcaption>`
      : "";
    const a = str(p.align, "center");
    const margin =
      a === "center"
        ? "margin-inline:auto"
        : a === "right"
          ? "margin-left:auto"
          : "";
    return `<figure class="ws-figure" style="width:fit-content;max-width:100%;${margin}">${body}${caption}</figure>`;
  },
  gallery: (ctx, _b, p) => {
    const items = list(p.items).filter((i) => i.media);
    if (!items.length) return placeholder(ctx, "Galerie");
    const fit = aspect(p.fit);
    const cols = Math.max(1, num(p.columns, 3));
    return `<div class="ws-grid ws-gallery" style="--cols:${cols};--cols-m:2;--gap:${num(p.gap, 12)}px">${items
      .map(
        (i) =>
          `<div class="ws-fit" style="${fit}">${picture(ctx, i.media, { alt: str(i.alt) || undefined, sizes: `(max-width: 768px) 50vw, ${Math.round(100 / cols)}vw` })}</div>`,
      )
      .join("")}</div>`;
  },
  video: (ctx, _b, p) => {
    const embed = videoEmbed(str(p.url), str(p.title, "Vidéo"));
    return embed
      ? `<div class="ws-video">${embed}</div>`
      : placeholder(ctx, "Vidéo");
  },
  spacer: (_ctx, _b, p) =>
    `<div aria-hidden="true" class="ws-spacer" style="height:${num(p.height, 48)}px"></div>`,
  divider: (_ctx, _b, p) =>
    `<hr class="ws-divider" style="--t:${num(p.thickness, 1)}px;--w:${num(p.width, 100)}%${color(p.color) ? `;--c:${color(p.color)}` : ""}">`,
  quote: (ctx, _b, p) =>
    `<blockquote class="ws-quote"><p${ed(ctx, "text")}>${esc(p.text)}</p>${
      str(p.author) || ctx.editor
        ? `<footer${ed(ctx, "author")}>${esc(p.author)}</footer>`
        : ""
    }</blockquote>`,
  hero: (ctx, _b, p) => {
    const variant = str(p.variant, "center");
    const img = picture(ctx, p.media, {
      eager: true,
      sizes:
        variant === "background" ? "100vw" : "(max-width: 768px) 100vw, 50vw",
    });
    const actions = [
      button(ctx, p.primaryLabel, p.primaryUrl, "primaryLabel"),
      button(
        ctx,
        p.secondaryLabel,
        p.secondaryUrl,
        "secondaryLabel",
        "outline",
      ),
    ].join("");
    const eyebrow =
      str(p.eyebrow) || ctx.editor
        ? `<p class="ws-hero__eyebrow"${ed(ctx, "eyebrow")}>${esc(p.eyebrow)}</p>`
        : "";
    const text =
      str(p.text) || ctx.editor
        ? `<p class="ws-hero__text"${ed(ctx, "text")}>${esc(p.text)}</p>`
        : "";
    const body = `<div class="ws-hero__body">${eyebrow}<h1${ed(ctx, "title")}>${esc(p.title)}</h1>${text}${
      actions ? `<div class="ws-actions">${actions}</div>` : ""
    }</div>`;
    const media =
      img && variant !== "center"
        ? `<div class="ws-hero__media">${img}</div>`
        : "";
    return `<div class="ws-hero ws-hero--${esc(variant)}">${body}${media}</div>`;
  },
  features: (ctx, _b, p) =>
    `<div class="ws-grid" style="--cols:${num(p.columns, 3)};${alignStyle(p.align)}">${list(
      p.items,
    )
      .map(
        (i, n) =>
          `<div class="ws-card">${
            str(i.icon) || ctx.editor
              ? `<span class="ws-feature__icon" aria-hidden="true"${ed(ctx, `items.${n}.icon`)}>${esc(i.icon)}</span>`
              : ""
          }<h3${ed(ctx, `items.${n}.title`)}>${esc(
            i.title,
          )}</h3><p${ed(ctx, `items.${n}.text`)}>${esc(i.text)}</p></div>`,
      )
      .join("")}</div>`,
  cards: (ctx, _b, p) => {
    const cols = num(p.columns, 3);
    return `<div class="ws-grid" style="--cols:${cols}">${list(p.items)
      .map((i, n) => {
        const img = picture(ctx, i.media, {
          sizes: `(max-width: 768px) 100vw, ${Math.round(100 / cols)}vw`,
        });
        const inner = `${img ? `<div class="ws-card__media">${img}</div>` : ""}<h3${ed(ctx, `items.${n}.title`)}>${esc(i.title)}</h3><p${ed(
          ctx,
          `items.${n}.text`,
        )}>${esc(i.text)}</p>`;
        const href = safeUrl(i.url);
        return href && !ctx.editor
          ? `<a class="ws-card" href="${esc(href)}">${inner}</a>`
          : `<div class="ws-card">${inner}</div>`;
      })
      .join("")}</div>`;
  },
  stats: (ctx, _b, p) =>
    `<div class="ws-stats">${list(p.items)
      .map(
        (i, n) =>
          `<div><span class="ws-stat__value"${ed(ctx, `items.${n}.value`)}>${esc(i.value)}</span><span class="ws-stat__label"${ed(ctx, `items.${n}.label`)}>${esc(i.label)}</span></div>`,
      )
      .join("")}</div>`,
  testimonials: (ctx, _b, p) =>
    `<div class="ws-grid" style="--cols:${num(p.columns, 2)}">${list(p.items)
      .map(
        (i, n) =>
          `<figure class="ws-testimonial"><blockquote style="margin:0"><p${ed(ctx, `items.${n}.text`)}>${esc(i.text)}</p></blockquote><figcaption>${picture(
            ctx,
            i.media,
            {
              alt: "",
              sizes: "44px",
            },
          )}<span><strong${ed(ctx, `items.${n}.name`)}>${esc(i.name)}</strong><br><span class="ws-meta"${ed(ctx, `items.${n}.role`)}>${esc(i.role)}</span></span></figcaption></figure>`,
      )
      .join("")}</div>`,
  faq: (ctx, _b, p) =>
    `<div class="ws-faq">${list(p.items)
      .map(
        (i, n) =>
          `<details${ctx.editor ? " open" : ""}><summary${ed(ctx, `items.${n}.question`)}>${esc(i.question)}</summary><p${ed(ctx, `items.${n}.answer`)}>${esc(i.answer)}</p></details>`,
      )
      .join("")}</div>`,
  cta: (ctx, _b, p) =>
    `<div class="ws-cta"><h2${ed(ctx, "title")}>${esc(p.title)}</h2>${str(p.text) || ctx.editor ? `<p${ed(ctx, "text")}>${esc(p.text)}</p>` : ""}${
      str(p.label)
        ? `<div class="ws-actions" style="justify-content:center">${button(ctx, p.label, p.url, "label")}</div>`
        : ""
    }</div>`,
  contact: (ctx, _b, p) => {
    const rows = [
      ["Adresse", str(p.address) && esc(p.address).replaceAll("\n", "<br>")],
      [
        "E-mail",
        str(p.email) && `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>`,
      ],
      [
        "Téléphone",
        str(p.phone) &&
          `<a href="tel:${esc(str(p.phone).replace(/\s/g, ""))}">${esc(p.phone)}</a>`,
      ],
      ["Horaires", str(p.hours) && esc(p.hours).replaceAll("\n", "<br>")],
    ].filter(([, v]) => v);
    if (!rows.length) return placeholder(ctx, "Coordonnées");
    return `<address class="ws-contact">${rows.map(([k, v]) => `<div><strong>${k}</strong>${v}</div>`).join("")}</address>`;
  },
  map: (ctx, _b, p) => {
    const query = str(p.query);
    if (!query) return placeholder(ctx, "Carte");
    return `<div class="ws-map"><iframe title="Carte : ${esc(query)}" height="${num(p.height, 320)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=${encodeURIComponent(query)}&amp;output=embed"></iframe></div>`;
  },
  social: (_ctx, _b, p) => {
    const a = str(p.align);
    const justify =
      a === "center" ? "center" : a === "right" ? "flex-end" : "flex-start";
    return `<ul class="ws-social" style="justify-content:${justify}">${list(
      p.items,
    )
      .map(
        (i) =>
          `<li><a href="${esc(safeUrl(i.url) || "#")}" rel="noopener" target="_blank">${esc(i.label)}</a></li>`,
      )
      .join("")}</ul>`;
  },
  embed: (ctx, _b, p) =>
    str(p.html)
      ? `<div class="ws-embed">${str(p.html)}</div>`
      : placeholder(ctx, "Intégration"),
  posts: (ctx, _b, p) => {
    const items = ctx.posts(
      str(p.typeId),
      num(p.limit, 6),
      str(p.tagId) || undefined,
    );
    if (!items.length)
      return ctx.editor
        ? '<div class="ws-empty">Aucun contenu publié</div>'
        : "";
    const showCover = bool(p.showCover ?? true);
    const showExcerpt = bool(p.showExcerpt ?? true);
    const showDate = bool(p.showDate ?? true);
    const meta = (i: ContentSummary) =>
      showDate && i.publishedAt
        ? `<time class="ws-meta" datetime="${new Date(i.publishedAt).toISOString()}">${dateFormat(ctx, i.publishedAt)}</time>`
        : "";
    if (str(p.display) === "list") {
      return `<div>${items
        .map(
          (i) =>
            `<a class="ws-post" href="${esc(i.url)}">${
              showCover && i.coverId
                ? `<div class="ws-post__media">${picture(ctx, i.coverId, { alt: "", sizes: "160px" })}</div>`
                : ""
            }<div><h3>${esc(i.title)}</h3>${meta(i)}${showExcerpt && i.excerpt ? `<p>${esc(i.excerpt)}</p>` : ""}</div></a>`,
        )
        .join("")}</div>`;
    }
    const cols = num(p.columns, 3);
    return `<div class="ws-grid" style="--cols:${cols}">${items
      .map(
        (i) =>
          `<a class="ws-card" href="${esc(i.url)}">${
            showCover && i.coverId
              ? `<div class="ws-card__media">${picture(ctx, i.coverId, { alt: "", sizes: `(max-width: 768px) 100vw, ${Math.round(100 / cols)}vw` })}</div>`
              : ""
          }${meta(i)}<h3>${esc(i.title)}</h3>${showExcerpt && i.excerpt ? `<p>${esc(i.excerpt)}</p>` : ""}</a>`,
      )
      .join("")}</div>`;
  },
  "content-title": (ctx, _b, p) => {
    const title = esc(ctx.content?.title ?? "Titre du contenu");
    // Dans une carte : titre de niveau 2, lien vers le contenu (toute la carte est cliquable).
    return ctx.content?.url
      ? `<h2 class="ws-entry__title" style="${alignStyle(p.align)}"><a href="${esc(ctx.content.url)}">${title}</a></h2>`
      : `<h1 style="${alignStyle(p.align)}">${title}</h1>`;
  },
  "content-excerpt": (ctx, _b, p) =>
    ctx.content?.excerpt
      ? `<p class="ws-excerpt" style="${alignStyle(p.align)}">${esc(ctx.content.excerpt)}</p>`
      : placeholder(ctx, "Description"),
  "archive-title": (ctx, _b, p) =>
    `<h1 style="${alignStyle(p.align)}">${esc(ctx.archive?.title ?? "Titre de la liste")}</h1>`,
  "archive-list": (ctx, block, p) => renderArchiveList(ctx, block, p),
  "content-meta": (ctx, _b, p) => {
    const parts = [
      bool(p.showDate ?? true) && ctx.content?.publishedAt
        ? `<time datetime="${new Date(ctx.content.publishedAt).toISOString()}">${dateFormat(ctx, ctx.content.publishedAt)}</time>`
        : "",
      bool(p.showAuthor ?? true) && ctx.content?.authorName
        ? esc(ctx.content.authorName)
        : "",
    ].filter(Boolean);
    const tags = bool(p.showTags ?? true)
      ? tagLinks(ctx, ctx.content?.tags)
      : "";
    if (!parts.length && !tags) return "";
    return `<div class="ws-meta-row" style="${alignStyle(p.align)}">${parts.length ? `<p class="ws-meta">${parts.join(" | ")}</p>` : ""}${
      tags ? `<p class="ws-tags">${tags}</p>` : ""
    }</div>`;
  },
  "content-tags": (ctx) => {
    const tags = tagLinks(ctx, ctx.content?.tags);
    return tags ? `<p class="ws-tags">${tags}</p>` : placeholder(ctx, "Tags");
  },
  "content-cover": (ctx, _b, p) => {
    const inCard = !!ctx.content?.url;
    const img = picture(ctx, ctx.content?.coverId, {
      eager: !inCard,
      sizes: inCard ? "(max-width: 768px) 100vw, 33vw" : "100vw",
    });
    if (!img) return placeholder(ctx, "Image de couverture");
    const fit = aspect(p.fit);
    return `<div class="${fit ? "ws-fit" : ""}" style="${fit};border-radius:var(--ws-radius)">${img}</div>`;
  },
  "content-body": (ctx) =>
    `<div class="ws-prose">${ctx.content?.bodyHtml || placeholder(ctx, "Corps du contenu")}</div>`,
  "content-field": (ctx, _b, p) => {
    const field = ctx.content?.fields?.find((f) => f.key === str(p.field));
    if (!field) return placeholder(ctx, "Champ à choisir");
    const value = fieldValue(ctx, field, ctx.content?.data?.[field.key], p);
    if (!value) return placeholder(ctx, field.label);
    const label = bool(p.showLabel)
      ? `<p class="ws-field__label">${esc(field.label)}</p>`
      : "";
    return `<div class="ws-field" style="${alignStyle(p.align)}">${label}${value}</div>`;
  },
  logo: (ctx, _b, p) => {
    const height = num(p.height, 40);
    const img = picture(ctx, ctx.identity.logoId, {
      alt: bool(p.showName ?? true) ? "" : ctx.identity.name,
      sizes: `${height * 4}px`,
      height,
      eager: true,
    });
    const name =
      bool(p.showName ?? true) || !img
        ? `<span>${esc(ctx.identity.name)}</span>`
        : "";
    return `<a class="ws-logo" href="${esc(ctx.homeUrl ?? "/")}">${img}${name}</a>`;
  },
  menu: (ctx, block, p) => {
    const menu = ctx.menu(str(p.menuId, "main"));
    if (!menu?.items.length) return placeholder(ctx, "Menu vide");
    const variant = str(p.variant, "horizontal");
    const id = `menu-${block.id}`;
    const a = str(p.align, "right");
    const justify =
      a === "center" ? "center" : a === "left" ? "flex-start" : "flex-end";
    const toggle =
      variant === "vertical"
        ? ""
        : `<button class="ws-menu__toggle" type="button" data-ws-toggle aria-expanded="false" aria-controls="${id}" aria-label="Menu">${BURGER}</button>`;
    return `<nav class="ws-menu ws-menu--${esc(variant)}" aria-label="${esc(menu.name)}" style="justify-content:${justify}">${toggle}${menuItems(ctx, menu.items).replace("__ID__", id)}</nav>`;
  },
  "lang-switch": (ctx, _b, p) => {
    const languages = ctx.languages ?? [];
    if (languages.length < 2)
      return placeholder(ctx, "Activez l'extension Multilingue");
    const names = str(p.display, "codes") === "names";
    const links = languages
      .map(
        (l) =>
          `<li><a href="${esc(l.url)}" hreflang="${esc(l.tag)}" lang="${esc(l.tag)}"${
            l.current ? ' aria-current="true"' : ""
          }${names ? "" : ` title="${esc(l.label)}"`}>${esc(names ? l.label : l.code.toUpperCase())}</a></li>`,
      )
      .join("");
    const a = str(p.align, "right");
    const justify =
      a === "center" ? "center" : a === "left" ? "flex-start" : "flex-end";
    return `<nav class="ws-langs" aria-label="Langue"><ul style="justify-content:${justify}">${links}</ul></nav>`;
  },
  copyright: (ctx, _b, p) =>
    `<p class="ws-meta" style="margin:0;${alignStyle(p.align)}">© ${new Date().getFullYear()} ${esc(ctx.identity.name)}${
      str(p.text) || ctx.editor
        ? ` | <span${ed(ctx, "text")}>${esc(p.text)}</span>`
        : ""
    }</p>`,
};

const SAMPLE_ENTRY: ContentSummary = {
  id: "sample",
  typeId: "",
  title: "Titre d'exemple",
  slug: "exemple",
  status: "published",
  excerpt: "Une description d'exemple, pour voir la carte.",
  coverId: null,
  publishedAt: Date.UTC(2026, 0, 15),
  updatedAt: 0,
  lang: "",
  translationOf: null,
  url: "#",
  tags: [],
};

/**
 * Liste paginée d'une page d'archive. Les blocs enfants dessinent la carte,
 * rendue pour chaque contenu ; dans l'éditeur, seule la première carte est modifiable.
 */
function renderArchiveList(
  ctx: RenderContext,
  block: Block,
  p: Record<string, unknown>,
) {
  const archive = ctx.archive;
  const perPage = Math.min(48, Math.max(1, num(p.perPage, 12)));
  const page = archive?.page ?? 1;
  const result = ctx.postsPage?.({
    typeId: archive?.typeId ?? "",
    tagId: archive?.tagId,
    page,
    perPage,
    order: str(p.order, "recent"),
  }) ?? { items: [], total: 0 };
  const items =
    result.items.length || !ctx.editor ? result.items : [SAMPLE_ENTRY];
  if (!items.length)
    return `<p class="ws-entries__empty">${esc(str(p.empty, "Aucun contenu pour le moment."))}</p>`;
  const children = block.children ?? [];
  const card = bool(p.cardStyle ?? true);
  const entries = items
    .map((item, i) => {
      const first = i === 0;
      const entryCtx: RenderContext = {
        ...ctx,
        editor: ctx.editor && first,
        // Le style des blocs de la carte n'est collecté qu'une fois.
        css: first ? ctx.css : [],
        content: {
          title: item.title,
          bodyHtml: "",
          coverId: item.coverId,
          publishedAt: item.publishedAt,
          authorName: item.authorName,
          data: item.data,
          fields: archive?.fields,
          tags: item.tags,
          excerpt: item.excerpt,
          url: item.url,
        },
      };
      const inner = children.length
        ? renderBlocks(entryCtx, children)
        : `<h2 class="ws-entry__title"><a href="${esc(item.url)}">${esc(item.title)}</a></h2>`;
      return `<article class="ws-entry${card ? " ws-entry--card" : ""}">${inner}</article>`;
    })
    .join("");
  const list =
    str(p.display) === "list"
      ? `<div class="ws-entries ws-entries--list">${entries}</div>`
      : `<div class="ws-entries ws-grid" style="--cols:${num(p.columns, 3)}">${entries}</div>`;
  return (
    list + pagination(ctx, result.total, perPage, str(p.pagination, "numbers"))
  );
}

/** Pagination d'une archive : /blog, /blog/page/2, … */
function pagination(
  ctx: RenderContext,
  total: number,
  perPage: number,
  style: string,
) {
  const archive = ctx.archive;
  const pages = Math.ceil(total / perPage);
  if (!archive || style === "none" || pages < 2) return "";
  const page = archive.page;
  const href = (n: number) =>
    n <= 1 ? archive.basePath || "/" : `${archive.basePath}/page/${n}`;
  const link = (n: number, label: string, rel?: string) =>
    `<a href="${esc(href(n))}"${rel ? ` rel="${rel}"` : ""}${n === page ? ' aria-current="page"' : ""}>${label}</a>`;
  const prev = page > 1 ? link(page - 1, "← Précédent", "prev") : "";
  const next = page < pages ? link(page + 1, "Suivant →", "next") : "";
  const numbers =
    style === "numbers"
      ? Array.from({ length: pages }, (_, i) =>
          link(i + 1, String(i + 1)),
        ).join("")
      : "";
  return `<nav class="ws-pagination" aria-label="Pagination">${prev}${numbers}${next}</nav>`;
}

/** Bloc-champ d'un modèle : affiche la valeur saisie dans le contenu. */
const renderField: Renderer = (ctx, _block, p) => {
  const kind = fieldKind(_block.type);
  const field: ContentField = {
    key: str(p.key),
    label: str(p.label, "Champ"),
    type: kind,
  };
  const value = field.key
    ? fieldValue(ctx, field, ctx.content?.data?.[field.key], p)
    : "";
  if (!value) {
    if (!ctx.editor) return "";
    const kindLabel =
      CONTENT_FIELD_TYPES.find((t) => t.value === kind)?.label ?? kind;
    return `<div class="ws-field-slot"><strong>${esc(field.label)}</strong><span>${esc(kindLabel)}</span></div>`;
  }
  const label = bool(p.showLabel)
    ? `<p class="ws-field__label">${esc(field.label)}</p>`
    : "";
  return `<div class="ws-field" style="${alignStyle(p.align)}">${label}${value}</div>`;
};

export function renderBlock(ctx: RenderContext, block: Block): string {
  const renderer =
    RENDERERS[block.type] ??
    (isFieldBlock(block.type) ? renderField : undefined);
  if (!renderer) return "";
  collectCss(ctx, block);
  const inner = renderer(ctx, block, block.props ?? {});
  const def = blockDef(block.type);
  const editorAttr = ctx.editor
    ? ` data-ws-block="${esc(block.id)}" data-ws-type="${esc(block.type)}"${def?.container && !def.childType ? " data-ws-container" : ""}`
    : "";
  return `<div class="ws-block wsb-${esc(block.type)} b-${esc(block.id)}"${editorAttr}>${inner}</div>`;
}

export const renderBlocks = (ctx: RenderContext, blocks: Block[]) =>
  blocks.map((b) => renderBlock(ctx, b)).join("");

export const KNOWN_BLOCKS = Object.keys(RENDERERS);
