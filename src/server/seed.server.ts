import fs from "node:fs";
import path from "node:path";
import logoSvg from "../../public/twsb-mark.svg?raw";
import type { Block } from "../features/blocks/block.type";
import { blockId } from "../features/blocks/catalog";
import { type Db, onDbOpen, uid } from "./db.server";
import { env } from "./env.server";
import { mediaDir } from "./media.server";
import {
  getIdentity,
  getMenu,
  insertMedia,
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

/** Mise en page de l'accueil : titre et texte du contenu, puis les derniers articles. */
const homeTemplate = (): Block[] => [
  b("section", { width: "container" }, [
    b("content-title", { align: "left" }),
    b("content-body"),
  ]),
  b(
    "section",
    { width: "container" },
    [
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
    ],
    { desktop: { background: "var(--ws-surface)" } },
  ),
];

/** Texte de la page d'accueil d'exemple : comment elle est faite, par où commencer. */
const HOME_BODY = `<p>Cette page est un exemple. Elle montre comment fonctionne le site et vous pouvez la modifier ou la supprimer.</p>
<h2>Comment cette page est construite</h2>
<p>C'est un contenu du type Accueil. Son titre et ce texte se modifient dans Contenus. La disposition, avec la liste des derniers articles en dessous, se règle dans Types, en ouvrant Accueil.</p>
<h2>Par où commencer</h2>
<ul>
<li>Donnez son nom au site et choisissez le logo et les couleurs dans Identité.</li>
<li>Écrivez un article depuis Contenus, avec le bouton Nouveau.</li>
<li>Ajoutez des liens au menu du haut dans Menus.</li>
<li>Si vos contenus ont besoin de champs à eux, créez un type. Un type Événement peut par exemple avoir une date et un lieu.</li>
</ul>`;

/** Article d'exemple : ce que sait faire l'éditeur de texte. */
const ARTICLE_BODY = `<p>Cet article montre ce que sait faire l'éditeur de texte. Ouvrez-le dans Contenus pour voir comment il est écrit.</p>
<h2>Insérer un bloc</h2>
<p>Tapez <code>/</code> en début de ligne. Un menu propose des titres, des listes, une citation, du code ou une image de la médiathèque.</p>
<h2>Mettre en forme</h2>
<p>Sélectionnez quelques mots. Une bulle apparaît pour les passer en <strong>gras</strong> ou en faire un lien.</p>
<blockquote><p>Collez l'adresse d'une vidéo YouTube sur une ligne vide et elle s'affiche dans l'article.</p></blockquote>
<h2>Publier</h2>
<p>Un article reste en brouillon tant que vous ne cliquez pas sur Publier. Jusqu'à sa première publication, son adresse suit le titre.</p>`;

/** Logo d'exemple : le pictogramme TWSB, ajouté à la médiathèque comme un envoi. */
function seedLogo() {
  const id = uid();
  const bytes = Buffer.from(logoSvg, "utf8");
  fs.mkdirSync(mediaDir(id), { recursive: true });
  fs.writeFileSync(path.join(mediaDir(id), "original.svg"), bytes);
  return insertMedia({
    id,
    name: "twsb-mark.svg",
    mime: "image/svg+xml",
    ext: "svg",
    size: bytes.byteLength,
    width: null,
    height: null,
    alt: "Logo",
    variants: [],
    createdAt: Date.now(),
  });
}

/** Données de départ : layout, types, menu, logo et page d'accueil. */
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
    title: "Votre site est en ligne",
    slug: "accueil",
    status: "published",
    body: HOME_BODY,
  });
  saveContent(undefined, {
    typeId: "article",
    title: "Premier article",
    slug: "premier-article",
    status: "published",
    excerpt: "Un article d'exemple qui montre ce que sait faire l'éditeur.",
    body: ARTICLE_BODY,
  });
  const identity = getIdentity();
  saveIdentity({
    ...identity,
    homeId: home.id,
    logoId: identity.logoId || seedLogo().id,
  });
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
