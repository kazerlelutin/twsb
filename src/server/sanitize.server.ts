import sanitizeHtml from "sanitize-html";
import type { Block } from "../features/blocks/block.type";
import { blockDef } from "../features/blocks/catalog";

const RICH: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "a",
    "ul",
    "ol",
    "li",
    "blockquote",
    "code",
    "pre",
    "hr",
    "br",
    "img",
    "mark",
    "span",
    "label",
    "input",
    "div",
    "figure",
    "figcaption",
    "iframe",
  ],
  allowedAttributes: {
    a: [
      "href",
      "target",
      "rel",
      "class",
      "data-link-card",
      "data-display",
      "data-title",
      "data-description",
      "data-image",
      "data-site",
    ],
    img: ["src", "alt", "width", "height", "title", "class", "loading"],
    div: ["data-youtube-video"],
    iframe: [
      "src",
      "title",
      "width",
      "height",
      "allowfullscreen",
      "loading",
      "allow",
    ],
    ul: ["data-type"],
    li: ["data-checked", "data-type"],
    input: ["type", "checked", "disabled"],
    p: ["style"],
    h1: ["style"],
    h2: ["style"],
    h3: ["style"],
    h4: ["style"],
    span: ["style", "class"],
    code: ["class"],
    pre: ["class"],
  },
  allowedStyles: {
    "*": {
      "text-align": [/^(left|right|center|justify)$/],
      color: [/^#[0-9a-f]{3,8}$/i],
    },
  },
  allowedClasses: {
    a: ["ws-link-card", "ws-link-card--card", "ws-link-card--inline"],
    span: ["ws-link-card__*"],
    img: ["ws-link-card__img"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https"], iframe: ["https"] },
  // Seules les vidéos YouTube (sans cookie) sont intégrables dans le texte.
  allowedIframeHostnames: ["www.youtube-nocookie.com", "www.youtube.com"],
  allowIframeRelativeUrls: false,
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs:
        attribs.target === "_blank"
          ? { ...attribs, rel: "noopener noreferrer" }
          : attribs,
    }),
    input: (tagName, attribs) => ({
      tagName,
      attribs: {
        type: "checkbox",
        disabled: "",
        ...(attribs.checked !== undefined ? { checked: "" } : {}),
      },
    }),
  },
};

const EMBED: sanitizeHtml.IOptions = {
  ...RICH,
  // Code d'intégration : tout iframe https (cartes, vidéos, formulaires).
  allowedIframeHostnames: undefined,
  allowedTags: [
    ...(RICH.allowedTags as string[]),
    "iframe",
    "table",
    "thead",
    "tbody",
    "tr",
    "td",
    "th",
  ],
  allowedAttributes: {
    ...RICH.allowedAttributes,
    iframe: [
      "src",
      "title",
      "width",
      "height",
      "allow",
      "allowfullscreen",
      "loading",
      "referrerpolicy",
      "frameborder",
    ],
  },
  allowedSchemesByTag: { img: ["http", "https"], iframe: ["https"] },
};

export const sanitizeRich = (html: string) => sanitizeHtml(html ?? "", RICH);
export const sanitizeEmbed = (html: string) => sanitizeHtml(html ?? "", EMBED);

/** Nettoie les champs HTML de chaque bloc avant enregistrement ou aperçu. */
export function sanitizeBlocks(blocks: unknown): Block[] {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .filter(
      (b): b is Block =>
        !!b &&
        typeof b === "object" &&
        typeof (b as Block).type === "string" &&
        !!blockDef((b as Block).type),
    )
    .map((block) => {
      const def = blockDef(block.type);
      const props: Record<string, unknown> = { ...(block.props ?? {}) };
      for (const field of def?.fields ?? []) {
        if (field.type === "richtext")
          props[field.key] = sanitizeRich(String(props[field.key] ?? ""));
        if (field.type === "code")
          props[field.key] = sanitizeEmbed(String(props[field.key] ?? ""));
      }
      return {
        id:
          String(block.id)
            .replace(/[^\w-]/g, "")
            .slice(0, 40) || "b",
        type: block.type,
        props,
        ...(block.style ? { style: block.style } : {}),
        ...(Array.isArray(block.children)
          ? { children: sanitizeBlocks(block.children) }
          : {}),
      };
    });
}
