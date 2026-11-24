import type { Block } from "../blocks/block.type";

export type Identity = {
  name: string;
  tagline: string;
  lang: string;
  logoId: string;
  faviconId: string;
  ogImageId: string;
  description: string;
  titleTemplate: string;
  homeId: string;
  colors: {
    primary: string;
    secondary: string;
    text: string;
    background: string;
    surface: string;
    muted: string;
  };
  fonts: { heading: string; body: string };
  radius: number;
  width: number;
};

export type FontDef = {
  label: string;
  stack: string;
  /** Fichier servi depuis /fonts (police variable, sous-ensemble latin). */
  file?: string;
  family?: string;
  kind: "sans" | "serif" | "mono";
};

export const FONT_STACKS: Record<string, FontDef> = {
  system: {
    label: "Système",
    kind: "sans",
    stack:
      "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
  inter: {
    label: "Inter",
    kind: "sans",
    file: "inter",
    family: "Inter Variable",
    stack: "'Inter Variable', Inter, system-ui, sans-serif",
  },
  manrope: {
    label: "Manrope",
    kind: "sans",
    file: "manrope",
    family: "Manrope Variable",
    stack: "'Manrope Variable', Manrope, system-ui, sans-serif",
  },
  outfit: {
    label: "Outfit",
    kind: "sans",
    file: "outfit",
    family: "Outfit Variable",
    stack: "'Outfit Variable', Outfit, system-ui, sans-serif",
  },
  "space-grotesk": {
    label: "Space Grotesk",
    kind: "sans",
    file: "space-grotesk",
    family: "Space Grotesk Variable",
    stack: "'Space Grotesk Variable', 'Space Grotesk', system-ui, sans-serif",
  },
  humanist: {
    label: "Humaniste",
    kind: "sans",
    stack:
      "Seravek, 'Gill Sans Nova', Ubuntu, Calibri, 'DejaVu Sans', source-sans-pro, sans-serif",
  },
  geometric: {
    label: "Géométrique",
    kind: "sans",
    stack:
      "Avenir, Montserrat, Corbel, 'URW Gothic', source-sans-pro, sans-serif",
  },
  "playfair-display": {
    label: "Playfair Display",
    kind: "serif",
    file: "playfair-display",
    family: "Playfair Display Variable",
    stack: "'Playfair Display Variable', 'Playfair Display', Georgia, serif",
  },
  fraunces: {
    label: "Fraunces",
    kind: "serif",
    file: "fraunces",
    family: "Fraunces Variable",
    stack: "'Fraunces Variable', Fraunces, Georgia, serif",
  },
  lora: {
    label: "Lora",
    kind: "serif",
    file: "lora",
    family: "Lora Variable",
    stack: "'Lora Variable', Lora, Georgia, serif",
  },
  "source-serif-4": {
    label: "Source Serif",
    kind: "serif",
    file: "source-serif-4",
    family: "Source Serif 4 Variable",
    stack: "'Source Serif 4 Variable', 'Source Serif 4', Georgia, serif",
  },
  serif: {
    label: "Serif",
    kind: "serif",
    stack:
      "Charter, 'Bitstream Charter', 'Sitka Text', Cambria, Georgia, serif",
  },
  didone: {
    label: "Didone",
    kind: "serif",
    stack:
      "Didot, 'Bodoni MT', 'Noto Serif Display', 'URW Palladio L', P052, Sylfaen, serif",
  },
  "jetbrains-mono": {
    label: "JetBrains Mono",
    kind: "mono",
    file: "jetbrains-mono",
    family: "JetBrains Mono Variable",
    stack:
      "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace",
  },
  mono: {
    label: "Mono",
    kind: "mono",
    stack:
      "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace",
  },
};

/** Déclarations @font-face des polices embarquées (toutes, ou celles demandées). */
export function fontFaces(keys?: string[]): string {
  return Object.entries(FONT_STACKS)
    .filter(([key, f]) => f.file && (!keys || keys.includes(key)))
    .map(
      ([, f]) =>
        `@font-face{font-family:'${f.family}';src:url(/fonts/${f.file}.woff2) format('woff2');font-weight:100 900;font-style:normal;font-display:swap}`,
    )
    .join("");
}

export const DEFAULT_IDENTITY: Identity = {
  name: "Mon site",
  tagline: "",
  lang: "fr",
  logoId: "",
  faviconId: "",
  ogImageId: "",
  description: "",
  titleTemplate: "%s | %site",
  homeId: "",
  colors: {
    primary: "#237ab3",
    secondary: "#152438",
    text: "#101c2c",
    background: "#ffffff",
    surface: "#f4f9fd",
    muted: "#51637a",
  },
  fonts: { heading: "system", body: "system" },
  radius: 8,
  width: 1180,
};

export type MediaVariant = {
  width: number;
  height: number;
  file: string;
  format: string;
};

export type MediaInfo = {
  id: string;
  name: string;
  mime: string;
  ext: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string;
  variants: MediaVariant[];
  createdAt: number;
};

export type MenuItem = {
  id: string;
  label: string;
  url?: string;
  contentId?: string;
  children?: MenuItem[];
};

export type Menu = { id: string; name: string; items: MenuItem[] };

export type Layout = {
  id: string;
  name: string;
  header: Block[];
  footer: Block[];
  options: {
    stickyHeader?: boolean;
    headerBackground?: string;
    footerBackground?: string;
  };
  isDefault: boolean;
};

export type ContentFieldType =
  | "text"
  | "textarea"
  | "richtext"
  | "number"
  | "date"
  | "toggle"
  | "select"
  | "media"
  | "gallery"
  | "url"
  | "email"
  | "color";

export type ContentField = {
  key: string;
  label: string;
  type: ContentFieldType;
  required?: boolean;
  options?: string[];
};

export const CONTENT_FIELD_TYPES: { value: ContentFieldType; label: string }[] =
  [
    { value: "text", label: "Texte court" },
    { value: "textarea", label: "Texte long" },
    { value: "richtext", label: "Texte riche" },
    { value: "number", label: "Nombre" },
    { value: "date", label: "Date" },
    { value: "toggle", label: "Oui / non" },
    { value: "select", label: "Liste de choix" },
    { value: "media", label: "Image" },
    { value: "gallery", label: "Galerie" },
    { value: "url", label: "Lien" },
    { value: "email", label: "E-mail" },
    { value: "color", label: "Couleur" },
  ];

export type Tag = { id: string; name: string; slug: string; count?: number };

export type ContentType = {
  id: string;
  name: string;
  prefix: string;
  fields: ContentField[];
  hasBody: boolean;
  editor: "document" | "builder";
  layoutId: string | null;
  template: Block[];
  builtin: boolean;
  position: number;
};

export type ContentStatus = "draft" | "published";

export type Content = {
  id: string;
  typeId: string;
  title: string;
  slug: string;
  status: ContentStatus;
  excerpt: string;
  body: string;
  blocks: Block[];
  data: Record<string, unknown>;
  tags: Tag[];
  coverId: string | null;
  seoTitle: string;
  seoDescription: string;
  /** Langue du contenu : vide pour la langue principale du site. */
  lang: string;
  /** Contenu source dont celui-ci est la traduction. */
  translationOf: string | null;
  authorId: string | null;
  authorName?: string;
  publishedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type ContentSummary = Pick<
  Content,
  | "id"
  | "typeId"
  | "title"
  | "slug"
  | "status"
  | "excerpt"
  | "coverId"
  | "publishedAt"
  | "updatedAt"
  | "authorName"
  | "lang"
  | "translationOf"
> & { url: string; tags: Tag[] };

export type Language = { code: string; label: string };

/** Extensions activables depuis l'administration. */
export type Plugins = {
  i18n: { enabled: boolean; languages: Language[] };
};

export const DEFAULT_PLUGINS: Plugins = {
  i18n: { enabled: false, languages: [] },
};

/** Noms usuels des langues, pour proposer un libellé. */
export const LANGUAGE_NAMES: Record<string, string> = {
  fr: "Français",
  en: "English",
  es: "Español",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
  nl: "Nederlands",
  pl: "Polski",
  ca: "Català",
  br: "Brezhoneg",
  eu: "Euskara",
  ar: "العربية",
  zh: "中文",
  ja: "日本語",
};

export type Translation = {
  id: string;
  lang: string;
  title: string;
  status: ContentStatus;
  url: string;
};
