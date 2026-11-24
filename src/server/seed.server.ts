import type { Block } from "../features/blocks/block.type";
import { blockId } from "../features/blocks/catalog";
import { type Db, onDbOpen } from "./db.server";
import { env } from "./env.server";
import {
  getIdentity,
  getMenu,
  listLayouts,
  listTypes,
  saveContent,
  saveIdentity,
  saveLayout,
  saveMenu,
  saveType,
} from "./repo.server";
import { countUsers, createActiveUser } from "./users.server";

const b = (
  type: string,
  props: Record<string, unknown> = {},
  children?: Block[],
  style?: Block["style"],
): Block => ({
  id: blockId(),
  type,
  props,
  ...(children ? { children } : {}),
  ...(style ? { style } : {}),
});

const header = (): Block[] => [
  b(
    "section",
    { width: "wide" },
    [
      b("columns", { ratio: "1-2", gap: 24, valign: "center", stack: false }, [
        b("column", {}, [b("logo", { showName: true, height: 36 })]),
        b("column", {}, [
          b("menu", { menuId: "main", variant: "horizontal", align: "right" }),
        ]),
      ]),
    ],
    { desktop: { padding: { top: 16, bottom: 16 } } },
  ),
];

const footer = (): Block[] => [
  b(
    "section",
    { width: "wide" },
    [b("copyright", { text: "", align: "center" })],
    {
      desktop: {
        background: "var(--ws-secondary)",
        color: "#ffffff",
        padding: { top: 32, bottom: 32 },
      },
    },
  ),
];

const articleTemplate = (): Block[] => [
  b("section", { width: "container" }, [
    b("content-cover", { fit: "21/9" }),
    b("content-title", { align: "left" }),
    b("content-meta", { showDate: true, showAuthor: true }),
    b("content-body"),
  ]),
];

const pageTemplate = (): Block[] => [
  b("section", { width: "container" }, [
    b("content-title", { align: "left" }),
    b("content-body"),
  ]),
];

/** Mise en page de l'accueil : le contenu remplit le titre et le texte d'introduction. */
const homeTemplate = (): Block[] => [
  b("section", { width: "container" }, [
    b("content-title", { align: "center" }),
    b("content-body"),
  ]),
  b(
    "section",
    { width: "container" },
    [
      b("heading", {
        text: "Ce que nous faisons",
        level: "2",
        align: "center",
      }),
      b("features", {
        columns: 3,
        align: "left",
        items: [
          {
            icon: "◆",
            title: "Concevoir",
            text: "Des pages claires et rapides.",
          },
          {
            icon: "◆",
            title: "Publier",
            text: "Articles et pages au même endroit.",
          },
          { icon: "◆", title: "Partager", text: "Un site léger, partout." },
        ],
      }),
    ],
    { desktop: { background: "var(--ws-surface)" } },
  ),
  b("section", { width: "container" }, [
    b("heading", { text: "Derniers articles", level: "2" }),
    b("posts", {
      typeId: "article",
      limit: 3,
      display: "grid",
      columns: 3,
      showCover: true,
      showExcerpt: true,
      showDate: true,
    }),
  ]),
];

/** Données de départ : layout, types, menu et page d'accueil. */
export function seed(database: Db) {
  const empty = !database.get("SELECT 1 FROM content_types LIMIT 1");
  if (!empty) return;
  const layout =
    listLayouts()[0] ??
    saveLayout({
      name: "Principal",
      header: header(),
      footer: footer(),
      options: { stickyHeader: true },
      isDefault: true,
    });
  if (!listTypes().length) {
    saveType({
      id: "page",
      name: "Page",
      prefix: "",
      layoutId: layout.id,
      template: pageTemplate(),
      builtin: true,
      position: 0,
    });
    saveType({
      id: "accueil",
      name: "Accueil",
      prefix: "",
      layoutId: layout.id,
      template: homeTemplate(),
      position: 1,
    });
    saveType({
      id: "article",
      name: "Article",
      prefix: "blog",
      layoutId: layout.id,
      template: articleTemplate(),
      builtin: true,
      position: 2,
    });
  }
  if (!getMenu("main")) {
    saveMenu({
      id: "main",
      name: "Principal",
      items: [
        { id: blockId(), label: "Accueil", url: "/" },
        { id: blockId(), label: "Blog", url: "/blog" },
      ],
    });
  }
  const home = saveContent(undefined, {
    typeId: "accueil",
    title: "Votre site, simplement",
    slug: "accueil",
    status: "published",
    body: "<p>Chaque type définit sa mise en page ; chaque contenu remplit ses champs.</p>",
  });
  saveContent(undefined, {
    typeId: "article",
    title: "Premier article",
    slug: "premier-article",
    status: "published",
    excerpt: "Un exemple pour démarrer.",
    body: "<p>Écrivez ici. Tapez <code>/</code> dans l'éditeur pour insérer un bloc.</p>",
  });
  saveIdentity({ ...getIdentity(), homeId: home.id });
}

onDbOpen(seed);

let adminChecked = false;
/** Crée le premier administrateur depuis l'environnement. */
export async function ensureAdmin() {
  if (adminChecked) return;
  adminChecked = true;
  const { adminEmail, adminPassword } = env();
  if (countUsers() > 0 || !adminEmail || !adminPassword) return;
  await createActiveUser(adminEmail, adminPassword, "admin", "Administrateur");
}
export const resetAdminCheck = () => {
  adminChecked = false;
};
