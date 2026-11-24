import type { ChainedCommands } from "@tiptap/core";

export type SlashItem = {
  id: string;
  label: string;
  icon: string;
  keywords: string;
  compact?: boolean;
  run: (chain: ChainedCommands) => void;
};

export const SLASH_ITEMS: SlashItem[] = [
  {
    id: "text",
    label: "Texte",
    icon: "¶",
    keywords: "paragraphe texte p",
    compact: true,
    run: (c) => c.setParagraph().run(),
  },
  {
    id: "h1",
    label: "Titre 1",
    icon: "H1",
    keywords: "titre heading h1",
    run: (c) => c.setHeading({ level: 1 }).run(),
  },
  {
    id: "h2",
    label: "Titre 2",
    icon: "H2",
    keywords: "titre heading h2",
    compact: true,
    run: (c) => c.setHeading({ level: 2 }).run(),
  },
  {
    id: "h3",
    label: "Titre 3",
    icon: "H3",
    keywords: "titre heading h3",
    compact: true,
    run: (c) => c.setHeading({ level: 3 }).run(),
  },
  {
    id: "bullet",
    label: "Liste",
    icon: "•",
    keywords: "liste puces bullet ul",
    compact: true,
    run: (c) => c.toggleBulletList().run(),
  },
  {
    id: "ordered",
    label: "Liste numérotée",
    icon: "1.",
    keywords: "liste numero ordered ol",
    compact: true,
    run: (c) => c.toggleOrderedList().run(),
  },
  {
    id: "task",
    label: "Tâches",
    icon: "☑",
    keywords: "taches todo checklist case",
    run: (c) => c.toggleTaskList().run(),
  },
  {
    id: "quote",
    label: "Citation",
    icon: "❝",
    keywords: "citation quote blockquote",
    compact: true,
    run: (c) => c.toggleBlockquote().run(),
  },
  {
    id: "code",
    label: "Code",
    icon: "</>",
    keywords: "code bloc pre",
    run: (c) => c.toggleCodeBlock().run(),
  },
  {
    id: "divider",
    label: "Séparateur",
    icon: "―",
    keywords: "separateur ligne hr divider",
    run: (c) => c.setHorizontalRule().run(),
  },
  {
    id: "video",
    label: "Vidéo YouTube",
    icon: "▶",
    keywords: "video youtube embed integrer",
    run: () => undefined,
  },
  {
    id: "bookmark",
    label: "Lien avec aperçu",
    icon: "🔗",
    keywords: "lien apercu carte bookmark url",
    run: () => undefined,
  },
  {
    id: "image",
    label: "Image",
    icon: "▧",
    keywords: "image photo media",
    run: () => undefined,
  },
];

const fold = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filterSlash(query: string, compact = false) {
  const q = fold(query.trim());
  return SLASH_ITEMS.filter(
    (item) =>
      (!compact || item.compact) &&
      (!q || fold(`${item.label} ${item.keywords}`).includes(q)),
  ).slice(0, 10);
}
