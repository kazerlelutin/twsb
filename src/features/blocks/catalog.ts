import { CONTENT_FIELD_TYPES, type ContentFieldType } from "../site/site.type";
import type { Block, BlockDef, FieldDef } from "./block.type";

const align = (key = "align", label = "Alignement"): FieldDef => ({
  key,
  label,
  type: "select",
  options: [
    { value: "left", label: "Gauche" },
    { value: "center", label: "Centre" },
    { value: "right", label: "Droite" },
  ],
});

const buttonStyle: FieldDef = {
  key: "variant",
  label: "Style",
  type: "select",
  options: [
    { value: "primary", label: "Plein" },
    { value: "outline", label: "Contour" },
    { value: "link", label: "Lien" },
  ],
};

const filled = (key: string) => (v: Record<string, unknown>) =>
  typeof v[key] === "string" ? !!(v[key] as string).trim() : !!v[key];

const newTab: FieldDef = {
  key: "newTab",
  label: "Ouvrir dans un nouvel onglet",
  type: "toggle",
  when: filled("url"),
};

export const RATIOS = [
  { value: "1", label: "1" },
  { value: "1-1", label: "1 | 1" },
  { value: "1-2", label: "1 | 2" },
  { value: "2-1", label: "2 | 1" },
  { value: "1-1-1", label: "1 | 1 | 1" },
  { value: "1-2-1", label: "1 | 2 | 1" },
  { value: "1-1-1-1", label: "1 | 1 | 1 | 1" },
];

export const BLOCKS: BlockDef[] = [
  {
    type: "section",
    label: "Section",
    icon: "▭",
    category: "layout",
    container: true,
    fields: [
      {
        key: "width",
        label: "Largeur",
        type: "select",
        options: [
          { value: "container", label: "Contenue" },
          { value: "wide", label: "Large" },
          { value: "full", label: "Pleine" },
        ],
      },
      { key: "anchor", label: "Ancre (adresse #…)", type: "text" },
    ],
    defaults: () => ({ width: "container", anchor: "" }),
  },
  {
    type: "columns",
    label: "Colonnes",
    icon: "▥",
    category: "layout",
    container: true,
    childType: "column",
    fields: [
      { key: "ratio", label: "Répartition", type: "select", options: RATIOS },
      {
        key: "gap",
        label: "Espacement",
        type: "range",
        min: 0,
        max: 96,
        step: 4,
        unit: "px",
      },
      {
        key: "valign",
        label: "Alignement vertical",
        type: "select",
        options: [
          { value: "start", label: "Haut" },
          { value: "center", label: "Centre" },
          { value: "end", label: "Bas" },
          { value: "stretch", label: "Étiré" },
        ],
      },
      {
        key: "desktop",
        label: "Ordre sur ordinateur",
        type: "select",
        options: [
          { value: "row", label: "Normal" },
          { value: "row-reverse", label: "Inversé" },
        ],
      },
      {
        key: "mobile",
        label: "Sur mobile",
        type: "select",
        options: [
          { value: "stack", label: "Empilées" },
          { value: "stack-reverse", label: "Empilées, ordre inversé" },
          { value: "row", label: "Côte à côte" },
        ],
      },
    ],
    defaults: () => ({
      ratio: "1-1",
      gap: 32,
      valign: "start",
      desktop: "row",
      mobile: "stack",
    }),
  },
  {
    type: "column",
    label: "Colonne",
    icon: "▯",
    category: "layout",
    container: true,
    hidden: true,
    fields: [],
    defaults: () => ({}),
  },
  {
    type: "heading",
    label: "Titre",
    icon: "H",
    category: "basic",
    fields: [
      { key: "text", label: "Texte", type: "text" },
      {
        key: "level",
        label: "Niveau",
        type: "select",
        options: ["1", "2", "3", "4"].map((v) => ({
          value: v,
          label: `H${v}`,
        })),
      },
      align(),
    ],
    defaults: () => ({ text: "Titre", level: "2", align: "left" }),
  },
  {
    type: "text",
    label: "Texte",
    icon: "¶",
    category: "basic",
    fields: [{ key: "html", label: "Contenu", type: "richtext" }, align()],
    defaults: () => ({ html: "<p>Votre texte.</p>", align: "left" }),
  },
  {
    type: "button",
    label: "Bouton",
    icon: "⏵",
    category: "basic",
    fields: [
      { key: "label", label: "Libellé", type: "text" },
      { key: "url", label: "Lien", type: "url" },
      buttonStyle,
      {
        key: "size",
        label: "Taille",
        type: "select",
        options: [
          { value: "sm", label: "S" },
          { value: "md", label: "M" },
          { value: "lg", label: "L" },
        ],
      },
      align(),
      newTab,
    ],
    defaults: () => ({
      label: "En savoir plus",
      url: "/",
      variant: "primary",
      size: "md",
      align: "left",
      newTab: false,
    }),
  },
  {
    type: "image",
    label: "Image",
    icon: "▧",
    category: "media",
    fields: [
      { key: "media", label: "Image", type: "media" },
      { key: "alt", label: "Texte alternatif", type: "text" },
      { key: "caption", label: "Légende", type: "text" },
      { key: "url", label: "Lien", type: "url" },
      {
        key: "fit",
        label: "Cadrage",
        type: "select",
        options: [
          { value: "natural", label: "Naturel" },
          { value: "16/9", label: "16:9" },
          { value: "4/3", label: "4:3" },
          { value: "1/1", label: "Carré" },
          { value: "3/4", label: "Portrait" },
        ],
      },
      align(),
    ],
    defaults: () => ({
      media: "",
      alt: "",
      caption: "",
      url: "",
      fit: "natural",
      align: "center",
    }),
  },
  {
    type: "gallery",
    label: "Galerie",
    icon: "▦",
    category: "media",
    fields: [
      {
        key: "items",
        label: "Images",
        type: "list",
        itemLabel: "Image",
        fields: [
          { key: "media", label: "Image", type: "media" },
          { key: "alt", label: "Texte alternatif", type: "text" },
        ],
      },
      { key: "columns", label: "Colonnes", type: "range", min: 1, max: 6 },
      {
        key: "gap",
        label: "Espacement",
        type: "range",
        min: 0,
        max: 48,
        step: 4,
        unit: "px",
      },
      {
        key: "fit",
        label: "Cadrage",
        type: "select",
        options: [
          { value: "1/1", label: "Carré" },
          { value: "4/3", label: "4:3" },
          { value: "16/9", label: "16:9" },
        ],
      },
    ],
    defaults: () => ({ items: [], columns: 3, gap: 12, fit: "1/1" }),
  },
  {
    type: "video",
    label: "Vidéo",
    icon: "▶",
    category: "media",
    fields: [
      { key: "url", label: "YouTube, Vimeo ou MP4", type: "url" },
      { key: "title", label: "Titre", type: "text" },
    ],
    defaults: () => ({ url: "", title: "Vidéo" }),
  },
  {
    type: "spacer",
    label: "Espace",
    icon: "↕",
    category: "layout",
    fields: [
      {
        key: "height",
        label: "Hauteur",
        type: "range",
        min: 8,
        max: 240,
        step: 8,
        unit: "px",
      },
    ],
    defaults: () => ({ height: 48 }),
  },
  {
    type: "divider",
    label: "Séparateur",
    icon: "―",
    category: "layout",
    fields: [
      { key: "color", label: "Couleur", type: "color" },
      {
        key: "thickness",
        label: "Épaisseur",
        type: "range",
        min: 1,
        max: 8,
        unit: "px",
      },
      {
        key: "width",
        label: "Largeur",
        type: "range",
        min: 10,
        max: 100,
        step: 5,
        unit: "%",
      },
    ],
    defaults: () => ({ color: "", thickness: 1, width: 100 }),
  },
  {
    type: "quote",
    label: "Citation",
    icon: "❝",
    category: "basic",
    fields: [
      { key: "text", label: "Citation", type: "textarea" },
      { key: "author", label: "Auteur", type: "text" },
    ],
    defaults: () => ({ text: "Une phrase qui compte.", author: "" }),
  },
  {
    type: "hero",
    label: "Bannière",
    icon: "★",
    category: "composite",
    fields: [
      { key: "eyebrow", label: "Surtitre", type: "text" },
      { key: "title", label: "Titre", type: "text" },
      { key: "text", label: "Texte", type: "textarea" },
      {
        key: "variant",
        label: "Disposition",
        type: "select",
        options: [
          { value: "center", label: "Centrée, sans image" },
          { value: "split", label: "Image à droite" },
          { value: "split-left", label: "Image à gauche" },
          { value: "background", label: "Image en fond" },
        ],
      },
      {
        key: "media",
        label: "Image",
        type: "media",
        when: (v) => v.variant !== "center",
      },
      { key: "primaryLabel", label: "Bouton principal", type: "text" },
      {
        key: "primaryUrl",
        label: "Lien du bouton principal",
        type: "url",
        when: filled("primaryLabel"),
      },
      { key: "secondaryLabel", label: "Bouton secondaire", type: "text" },
      {
        key: "secondaryUrl",
        label: "Lien du bouton secondaire",
        type: "url",
        when: filled("secondaryLabel"),
      },
    ],
    defaults: () => ({
      eyebrow: "",
      title: "Un titre clair",
      text: "Une phrase qui explique la promesse.",
      media: "",
      variant: "center",
      primaryLabel: "Commencer",
      primaryUrl: "/",
      secondaryLabel: "",
      secondaryUrl: "",
    }),
  },
  {
    type: "features",
    label: "Atouts",
    icon: "✦",
    category: "composite",
    fields: [
      {
        key: "items",
        label: "Atouts",
        type: "list",
        itemLabel: "Atout",
        fields: [
          { key: "icon", label: "Icône", type: "text" },
          { key: "title", label: "Titre", type: "text" },
          { key: "text", label: "Texte", type: "textarea" },
        ],
      },
      { key: "columns", label: "Colonnes", type: "range", min: 1, max: 4 },
      align(),
    ],
    defaults: () => ({
      items: [
        { icon: "◆", title: "Simple", text: "Une idée par carte." },
        { icon: "◆", title: "Rapide", text: "Une idée par carte." },
        { icon: "◆", title: "Fiable", text: "Une idée par carte." },
      ],
      columns: 3,
      align: "left",
    }),
  },
  {
    type: "cards",
    label: "Cartes",
    icon: "▤",
    category: "composite",
    fields: [
      {
        key: "items",
        label: "Cartes",
        type: "list",
        itemLabel: "Carte",
        fields: [
          { key: "media", label: "Image", type: "media" },
          { key: "title", label: "Titre", type: "text" },
          { key: "text", label: "Texte", type: "textarea" },
          { key: "url", label: "Lien", type: "url" },
        ],
      },
      { key: "columns", label: "Colonnes", type: "range", min: 1, max: 4 },
    ],
    defaults: () => ({
      items: [
        { media: "", title: "Carte", text: "Description courte.", url: "" },
        { media: "", title: "Carte", text: "Description courte.", url: "" },
        { media: "", title: "Carte", text: "Description courte.", url: "" },
      ],
      columns: 3,
    }),
  },
  {
    type: "stats",
    label: "Chiffres",
    icon: "#",
    category: "composite",
    fields: [
      {
        key: "items",
        label: "Chiffres",
        type: "list",
        itemLabel: "Chiffre",
        fields: [
          { key: "value", label: "Valeur", type: "text" },
          { key: "label", label: "Libellé", type: "text" },
        ],
      },
    ],
    defaults: () => ({
      items: [
        { value: "120", label: "Projets" },
        { value: "98 %", label: "Satisfaction" },
        { value: "24 h", label: "Réponse" },
      ],
    }),
  },
  {
    type: "testimonials",
    label: "Témoignages",
    icon: "☺",
    category: "composite",
    fields: [
      {
        key: "items",
        label: "Témoignages",
        type: "list",
        itemLabel: "Témoignage",
        fields: [
          { key: "text", label: "Texte", type: "textarea" },
          { key: "name", label: "Nom", type: "text" },
          { key: "role", label: "Fonction", type: "text" },
          { key: "media", label: "Photo", type: "media" },
        ],
      },
      { key: "columns", label: "Colonnes", type: "range", min: 1, max: 3 },
    ],
    defaults: () => ({
      items: [
        {
          text: "Un retour client.",
          name: "Camille",
          role: "Cliente",
          media: "",
        },
      ],
      columns: 2,
    }),
  },
  {
    type: "faq",
    label: "FAQ",
    icon: "?",
    category: "composite",
    fields: [
      {
        key: "items",
        label: "Questions",
        type: "list",
        itemLabel: "Question",
        fields: [
          { key: "question", label: "Question", type: "text" },
          { key: "answer", label: "Réponse", type: "textarea" },
        ],
      },
    ],
    defaults: () => ({
      items: [{ question: "Une question ?", answer: "Une réponse." }],
    }),
  },
  {
    type: "cta",
    label: "Appel à l'action",
    icon: "➜",
    category: "composite",
    fields: [
      { key: "title", label: "Titre", type: "text" },
      { key: "text", label: "Texte", type: "textarea" },
      { key: "label", label: "Bouton", type: "text" },
      {
        key: "url",
        label: "Lien du bouton",
        type: "url",
        when: filled("label"),
      },
    ],
    defaults: () => ({
      title: "Prêt ?",
      text: "",
      label: "Nous contacter",
      url: "/contact",
    }),
  },
  {
    type: "contact",
    label: "Coordonnées",
    icon: "✉",
    category: "composite",
    fields: [
      { key: "address", label: "Adresse", type: "textarea" },
      { key: "email", label: "E-mail", type: "text" },
      { key: "phone", label: "Téléphone", type: "text" },
      { key: "hours", label: "Horaires", type: "textarea" },
    ],
    defaults: () => ({ address: "", email: "", phone: "", hours: "" }),
  },
  {
    type: "map",
    label: "Carte",
    icon: "⌖",
    category: "media",
    fields: [
      { key: "query", label: "Adresse ou lieu", type: "text" },
      {
        key: "height",
        label: "Hauteur",
        type: "range",
        min: 160,
        max: 640,
        step: 20,
        unit: "px",
      },
    ],
    defaults: () => ({ query: "Paris", height: 320 }),
  },
  {
    type: "social",
    label: "Réseaux",
    icon: "@",
    category: "site",
    fields: [
      {
        key: "items",
        label: "Liens",
        type: "list",
        itemLabel: "Lien",
        fields: [
          { key: "label", label: "Nom", type: "text" },
          { key: "url", label: "Lien", type: "url" },
        ],
      },
      align(),
    ],
    defaults: () => ({
      items: [{ label: "Instagram", url: "https://instagram.com" }],
      align: "left",
    }),
  },
  {
    type: "embed",
    label: "Intégration",
    icon: "</>",
    category: "media",
    fields: [{ key: "html", label: "HTML", type: "code" }],
    defaults: () => ({ html: "" }),
  },
  {
    type: "posts",
    label: "Liste de contenus",
    icon: "☰",
    category: "dynamic",
    fields: [
      { key: "typeId", label: "Type", type: "contentType" },
      { key: "tagId", label: "Tag", type: "tag" },
      { key: "limit", label: "Nombre", type: "range", min: 1, max: 24 },
      {
        key: "display",
        label: "Affichage",
        type: "select",
        options: [
          { value: "grid", label: "Grille" },
          { value: "list", label: "Liste" },
        ],
      },
      {
        key: "columns",
        label: "Colonnes",
        type: "range",
        min: 1,
        max: 4,
        when: (v) => v.display !== "list",
      },
      { key: "showCover", label: "Image", type: "toggle" },
      { key: "showExcerpt", label: "Description", type: "toggle" },
      { key: "showDate", label: "Date", type: "toggle" },
    ],
    defaults: () => ({
      typeId: "article",
      tagId: "",
      limit: 6,
      display: "grid",
      columns: 3,
      showCover: true,
      showExcerpt: true,
      showDate: true,
    }),
  },
  {
    type: "content-title",
    label: "Titre du contenu",
    icon: "H",
    category: "dynamic",
    scope: ["template"],
    fields: [align()],
    defaults: () => ({ align: "left" }),
  },
  {
    type: "content-meta",
    label: "Date, auteur, tags",
    icon: "◷",
    category: "dynamic",
    scope: ["template"],
    fields: [
      { key: "showDate", label: "Date", type: "toggle" },
      { key: "showAuthor", label: "Auteur", type: "toggle" },
      { key: "showTags", label: "Tags", type: "toggle" },
      align(),
    ],
    defaults: () => ({
      showDate: true,
      showAuthor: true,
      showTags: true,
      align: "left",
    }),
  },
  {
    type: "content-cover",
    label: "Image de couverture",
    icon: "▧",
    category: "dynamic",
    scope: ["template"],
    fields: [
      {
        key: "fit",
        label: "Cadrage",
        type: "select",
        options: [
          { value: "natural", label: "Naturel" },
          { value: "16/9", label: "16:9" },
          { value: "21/9", label: "21:9" },
        ],
      },
    ],
    defaults: () => ({ fit: "16/9" }),
  },
  {
    type: "content-body",
    label: "Corps du contenu",
    icon: "≡",
    category: "dynamic",
    scope: ["template"],
    fields: [],
    defaults: () => ({}),
  },
  {
    type: "content-field",
    label: "Champ",
    icon: "⊞",
    category: "dynamic",
    hidden: true,
    scope: ["template"],
    fields: [
      { key: "field", label: "Champ", type: "contentField" },
      {
        key: "level",
        label: "Style du texte",
        type: "select",
        options: [
          { value: "0", label: "Paragraphe" },
          { value: "2", label: "Titre 2" },
          { value: "3", label: "Titre 3" },
          { value: "4", label: "Titre 4" },
        ],
      },
      { key: "showLabel", label: "Afficher le nom du champ", type: "toggle" },
      { key: "linkLabel", label: "Texte du lien", type: "text" },
      align(),
    ],
    defaults: () => ({
      field: "",
      level: "0",
      showLabel: false,
      linkLabel: "",
      align: "left",
    }),
  },
  {
    type: "content-tags",
    label: "Tags",
    icon: "#",
    category: "dynamic",
    scope: ["template"],
    fields: [],
    defaults: () => ({}),
  },
  {
    type: "logo",
    label: "Logo",
    icon: "◎",
    category: "site",
    fields: [
      { key: "showName", label: "Nom du site", type: "toggle" },
      {
        key: "height",
        label: "Hauteur",
        type: "range",
        min: 16,
        max: 120,
        step: 4,
        unit: "px",
      },
    ],
    defaults: () => ({ showName: true, height: 40 }),
  },
  {
    type: "menu",
    label: "Menu",
    icon: "≣",
    category: "site",
    fields: [
      { key: "menuId", label: "Menu", type: "menu" },
      {
        key: "variant",
        label: "Type",
        type: "select",
        options: [
          { value: "horizontal", label: "Horizontal" },
          { value: "pills", label: "Pastilles" },
          { value: "underline", label: "Souligné" },
          { value: "burger", label: "Burger" },
          { value: "vertical", label: "Vertical" },
        ],
      },
      align(),
    ],
    defaults: () => ({ menuId: "main", variant: "horizontal", align: "right" }),
  },
  {
    type: "lang-switch",
    label: "Langues",
    icon: "文",
    category: "site",
    fields: [
      {
        key: "display",
        label: "Affichage",
        type: "select",
        options: [
          { value: "codes", label: "Codes (FR · EN)" },
          { value: "names", label: "Noms" },
        ],
      },
      align(),
    ],
    defaults: () => ({ display: "codes", align: "right" }),
  },
  {
    type: "copyright",
    label: "Copyright",
    icon: "©",
    category: "site",
    fields: [{ key: "text", label: "Texte", type: "text" }, align()],
    defaults: () => ({ text: "Tous droits réservés", align: "center" }),
  },
];

export const FIELD_PREFIX = "field-";
export const isFieldBlock = (type: string) => type.startsWith(FIELD_PREFIX);
export const fieldKind = (type: string) =>
  type.slice(FIELD_PREFIX.length) as ContentFieldType;

const FIELD_ICONS: Record<ContentFieldType, string> = {
  text: "T",
  textarea: "¶",
  richtext: "≡",
  number: "#",
  date: "◷",
  toggle: "◐",
  select: "☷",
  media: "▧",
  gallery: "▦",
  url: "⛓",
  email: "@",
  color: "●",
};

const TEXT_KINDS = new Set<ContentFieldType>([
  "text",
  "number",
  "date",
  "select",
  "email",
]);

/**
 * Champs du type : chaque bloc déposé dans le modèle crée un champ nommé,
 * que chaque contenu remplit ensuite dans son formulaire.
 */
const FIELD_BLOCKS: BlockDef[] = CONTENT_FIELD_TYPES.map(
  ({ value: kind, label }) => ({
    type: `${FIELD_PREFIX}${kind}`,
    // « Champ … » : distinct des blocs ordinaires (Image, Lien, Galerie…).
    label: `Champ ${label.toLowerCase()}`,
    icon: FIELD_ICONS[kind],
    category: "fields",
    scope: ["template"],
    fields: [
      { key: "label", label: "Nom du champ", type: "text" },
      { key: "required", label: "Obligatoire", type: "toggle" },
      ...(kind === "select"
        ? [
            {
              key: "options",
              label: "Choix, séparés par des virgules",
              type: "textarea",
            } as FieldDef,
          ]
        : []),
      ...(TEXT_KINDS.has(kind)
        ? [
            {
              key: "level",
              label: "Style du texte",
              type: "select",
              options: [
                { value: "0", label: "Paragraphe" },
                { value: "1", label: "Titre 1" },
                { value: "2", label: "Titre 2" },
                { value: "3", label: "Titre 3" },
              ],
            } as FieldDef,
          ]
        : []),
      ...(kind === "url"
        ? [
            {
              key: "linkLabel",
              label: "Texte du bouton",
              type: "text",
            } as FieldDef,
          ]
        : []),
      ...(kind === "gallery"
        ? [
            {
              key: "columns",
              label: "Colonnes",
              type: "range",
              min: 1,
              max: 6,
            } as FieldDef,
          ]
        : []),
      { key: "showLabel", label: "Afficher le nom du champ", type: "toggle" },
      align(),
    ],
    defaults: () => ({
      label,
      key: "",
      required: false,
      level: "0",
      showLabel: false,
      align: "left",
      ...(kind === "select" ? { options: "" } : {}),
    }),
  }),
);

BLOCKS.unshift(...FIELD_BLOCKS);

const byType = new Map(BLOCKS.map((def) => [def.type, def]));

export const blockDef = (type: string) => byType.get(type);

export const CATEGORY_LABELS: Record<string, string> = {
  fields: "Champs à remplir",
  layout: "Structure",
  basic: "Base",
  media: "Média",
  composite: "Sections",
  dynamic: "Dynamique",
  site: "Site",
};

const NO_TEXT = new Set([
  "image",
  "gallery",
  "video",
  "map",
  "spacer",
  "divider",
  "embed",
]);
const NO_BOX = new Set(["spacer", "divider"]);

/** Réglages de style communs ; certains ne s'affichent que s'ils ont un effet. */
export const STYLE_FIELDS: FieldDef[] = [
  {
    key: "padding",
    label: "Marge intérieure",
    type: "spacing",
    when: (_v, c) => !NO_BOX.has(c.type),
  },
  { key: "margin", label: "Marge extérieure", type: "spacing" },
  {
    key: "background",
    label: "Couleur de fond",
    type: "color",
    when: (_v, c) => !NO_BOX.has(c.type),
  },
  {
    key: "backgroundImage",
    label: "Image de fond",
    type: "media",
    when: (_v, c) => !NO_BOX.has(c.type),
  },
  {
    key: "overlay",
    label: "Assombrir l'image de fond",
    type: "range",
    min: 0,
    max: 90,
    step: 10,
    unit: "%",
    when: (v, c) => c.type === "section" && !!v.backgroundImage,
  },
  {
    key: "color",
    label: "Couleur du texte",
    type: "color",
    when: (_v, c) => !NO_TEXT.has(c.type),
  },
  {
    key: "align",
    label: "Alignement du texte",
    type: "select",
    when: (_v, c) => !NO_TEXT.has(c.type),
    options: [
      { value: "", label: "Par défaut" },
      { value: "left", label: "Gauche" },
      { value: "center", label: "Centre" },
      { value: "right", label: "Droite" },
    ],
  },
  {
    key: "fontSize",
    label: "Taille du texte",
    type: "range",
    min: 10,
    max: 96,
    unit: "px",
    when: (_v, c) => !NO_TEXT.has(c.type),
  },
  {
    key: "maxWidth",
    label: "Largeur maximale",
    type: "range",
    min: 40,
    max: 1600,
    step: 10,
    unit: "px",
  },
  {
    key: "minHeight",
    label: "Hauteur minimale",
    type: "range",
    min: 0,
    max: 1000,
    step: 10,
    unit: "px",
    when: (_v, c) => !NO_BOX.has(c.type),
  },
  {
    key: "radius",
    label: "Coins arrondis",
    type: "range",
    min: 0,
    max: 48,
    unit: "px",
    when: (_v, c) => !NO_BOX.has(c.type),
  },
  {
    key: "shadow",
    label: "Ombre portée",
    type: "toggle",
    when: (_v, c) => !NO_BOX.has(c.type),
  },
  { key: "hidden", label: "Masquer sur cet appareil", type: "toggle" },
];

let counter = 0;
export const blockId = () =>
  `b${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function createBlock(type: string): Block {
  const def = blockDef(type);
  if (!def) throw new Error(`Bloc inconnu : ${type}`);
  const block: Block = { id: blockId(), type, props: def.defaults() };
  if (type === "columns") {
    block.children = [createBlock("column"), createBlock("column")];
  } else if (def.container) {
    block.children = [];
  }
  return block;
}

/** Copie profonde avec de nouveaux identifiants. */
export function cloneBlock(block: Block): Block {
  return {
    ...structuredClone(block),
    id: blockId(),
    children: block.children?.map(cloneBlock),
  };
}

export const ratioParts = (ratio: unknown) =>
  String(ratio || "1-1")
    .split("-")
    .map((n) => Number(n) || 1);

/** Ajuste le nombre de colonnes à la répartition choisie. */
export function syncColumns(block: Block): Block {
  if (block.type !== "columns") return block;
  const count = ratioParts(block.props.ratio).length;
  const children = [...(block.children ?? [])];
  while (children.length < count) children.push(createBlock("column"));
  if (children.length > count) {
    const extra = children.splice(count);
    const last = children[count - 1];
    last.children = [
      ...(last.children ?? []),
      ...extra.flatMap((c) => c.children ?? []),
    ];
  }
  return { ...block, children };
}

export function paletteFor(scope: "content" | "layout" | "template") {
  return BLOCKS.filter(
    (def) => !def.hidden && (!def.scope || def.scope.includes(scope)),
  );
}
