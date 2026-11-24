import { describe, expect, test } from "vitest";
import type { Block } from "../blocks/block.type";
import { BLOCKS, createBlock } from "../blocks/catalog";
import { DEFAULT_IDENTITY, type MediaInfo } from "../site/site.type";
import { type RenderContext, renderBlock } from "./blocks.render";
import { safeUrl, slugify } from "./html";
import { pageTitle, renderDocument } from "./page.render";

const media: MediaInfo = {
  id: "m1",
  name: "photo.jpg",
  mime: "image/jpeg",
  ext: "jpg",
  size: 100,
  width: 1600,
  height: 900,
  alt: "Une photo",
  variants: [
    { width: 320, height: 180, file: "w320.webp", format: "webp" },
    { width: 1280, height: 720, file: "w1280.webp", format: "webp" },
  ],
  createdAt: 0,
};

const context = (over: Partial<RenderContext> = {}): RenderContext => ({
  identity: DEFAULT_IDENTITY,
  media: (id) => (id === "m1" ? media : undefined),
  menu: (id) =>
    id === "main"
      ? {
          id: "main",
          name: "Principal",
          items: [
            { id: "1", label: "Accueil", url: "/" },
            {
              id: "2",
              label: "Blog",
              url: "/blog",
              children: [{ id: "3", label: "Tech", url: "/blog/tech" }],
            },
          ],
        }
      : undefined,
  posts: () => [
    {
      id: "p",
      typeId: "article",
      title: "Billet",
      slug: "billet",
      status: "published",
      excerpt: "Résumé",
      coverId: "m1",
      publishedAt: 0,
      updatedAt: 0,
      url: "/blog/billet",
      lang: "",
      translationOf: null,
      tags: [],
    },
  ],
  contentUrl: () => "/a-propos",
  css: [],
  ...over,
});

describe("rendu des blocs", () => {
  test("le texte alternatif du média s'applique, sauf texte propre au bloc", () => {
    const image = (alt: string) =>
      renderBlock(context(), {
        id: "i",
        type: "image",
        props: { media: "m1", alt },
      });
    expect(image("")).toContain('alt="Une photo"');
    expect(image("Vue du port")).toContain('alt="Vue du port"');
    const field = renderBlock(
      context({
        content: {
          title: "T",
          bodyHtml: "",
          coverId: "m1",
          publishedAt: 0,
          data: { visuel: "m1" },
          fields: [{ key: "visuel", label: "Visuel", type: "media" }],
        },
      }),
      {
        id: "f",
        type: "field-media",
        props: { key: "visuel", label: "Visuel" },
      },
    );
    expect(field).toContain('alt="Une photo"');
    const cover = renderBlock(
      context({
        content: { title: "T", bodyHtml: "", coverId: "m1", publishedAt: 0 },
      }),
      { id: "c", type: "content-cover", props: {} },
    );
    expect(cover).toContain('alt="Une photo"');
  });

  test("chaque bloc du catalogue se rend sans erreur", () => {
    for (const def of BLOCKS) {
      const html = renderBlock(context(), createBlock(def.type));
      expect(html, def.type).toContain(`wsb-${def.type}`);
    }
  });

  test("échappe le texte et neutralise les liens dangereux", () => {
    const block: Block = {
      id: "x",
      type: "button",
      props: { label: "<b>ok</b>", url: "javascript:alert(1)" },
    };
    const html = renderBlock(context(), block);
    expect(html).toContain("&lt;b&gt;ok&lt;/b&gt;");
    expect(html).not.toContain("javascript:");
  });

  test("produit des images responsives au format webp", () => {
    const html = renderBlock(context(), {
      id: "i",
      type: "image",
      props: { media: "m1", alt: "" },
    });
    expect(html).toContain('type="image/webp"');
    expect(html).toContain("/media/m1/w320.webp 320w");
    expect(html).toContain('width="1600"');
    expect(html).toContain('loading="lazy"');
  });

  test("applique un style spécifique au mobile", () => {
    const ctx = context();
    renderBlock(ctx, {
      id: "s",
      type: "heading",
      props: { text: "T" },
      style: {
        desktop: { fontSize: 40 },
        mobile: { fontSize: 24, hidden: true },
      },
    });
    expect(ctx.css.join("")).toContain(".b-s{font-size:40px}");
    expect(ctx.css.join("")).toContain(
      "@media (max-width:768px){.b-s{font-size:24px}}",
    );
    expect(ctx.css.join("")).toContain(
      "@media (max-width:768px){.b-s{display:none}}",
    );
  });

  test("la taille de texte d'un bloc titre vise le h1-h4 (sinon écrasée par le thème)", () => {
    for (const type of ["heading", "archive-title", "content-title"]) {
      const ctx = context();
      renderBlock(ctx, {
        id: "t",
        type,
        props: { text: "T" },
        style: { desktop: { fontSize: 72 }, mobile: { fontSize: 32 } },
      });
      const css = ctx.css.join("");
      expect(css).toContain(".b-t>:is(h1,h2,h3,h4){font-size:72px}");
      expect(css).toContain(
        "@media (max-width:768px){.b-t>:is(h1,h2,h3,h4){font-size:32px}}",
      );
    }
  });

  test("rend un menu avec bouton mobile accessible et page courante", () => {
    const html = renderBlock(context({ currentPath: "/blog" }), {
      id: "m",
      type: "menu",
      props: { menuId: "main" },
    });
    expect(html).toContain('aria-controls="menu-m"');
    expect(html).toContain('id="menu-m"');
    expect(html).toContain('<a href="/blog" aria-current="page">');
    expect(html).toContain("ws-menu__sub");
  });

  test("le mode éditeur marque les blocs sélectionnables", () => {
    const html = renderBlock(context({ editor: true }), createBlock("section"));
    expect(html).toContain("data-ws-block=");
    expect(html).toContain("ws-dropzone");
  });

  test("intègre YouTube sans cookie", () => {
    const html = renderBlock(context(), {
      id: "v",
      type: "video",
      props: { url: "https://youtu.be/dQw4w9WgXcQ" },
    });
    expect(html).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });
});

describe("document", () => {
  test("assemble layout, contenu et métadonnées", () => {
    const html = renderDocument({
      ctx: context(),
      layout: {
        id: "l",
        name: "L",
        header: [{ id: "h", type: "logo", props: {} }],
        footer: [{ id: "f", type: "copyright", props: {} }],
        options: { stickyHeader: true },
        isDefault: true,
      },
      main: [
        { id: "t", type: "heading", props: { text: "Bonjour", level: "1" } },
      ],
      title: "Accueil",
      description: "Desc",
    });
    expect(html).toMatch(/^<!doctype html><html lang="fr">/);
    expect(html).toContain("<title>Accueil | Mon site</title>");
    expect(html).toContain('<meta name="description" content="Desc">');
    expect(html).toContain('class="ws-header ws-header--sticky"');
    expect(html).toContain('<main id="main"');
    expect(html).not.toContain("data-ws-block");
  });

  test("titre de page", () => {
    expect(pageTitle("%s | %site", "A", "Site")).toBe("A | Site");
    expect(pageTitle("%s | %site", "Site", "Site")).toBe("Site");
  });
});

describe("utilitaires", () => {
  test("slug", () => {
    expect(slugify("  Été à Paris !")).toBe("ete-a-paris");
  });
  test("url sûre", () => {
    expect(safeUrl("data:text/html,x")).toBe("");
    expect(safeUrl("//evil.com")).toBe("");
    expect(safeUrl("/\\evil.com")).toBe("");
    expect(safeUrl("contact")).toBe("/contact");
    expect(safeUrl("https://a.fr")).toBe("https://a.fr");
  });
});

describe("sens des colonnes", () => {
  test("ordre inversé sur ordinateur et empilement inversé sur mobile", () => {
    const html = renderBlock(context(), {
      id: "c",
      type: "columns",
      props: { ratio: "1-2", desktop: "row-reverse", mobile: "stack-reverse" },
      children: [],
    });
    expect(html).toContain("ws-columns--d-reverse");
    expect(html).toContain("ws-columns--m-stack-reverse");
  });

  test("les anciens réglages restent compris", () => {
    expect(
      renderBlock(context(), {
        id: "c",
        type: "columns",
        props: { stack: false },
        children: [],
      }),
    ).toContain("ws-columns--m-row");
    expect(
      renderBlock(context(), {
        id: "c",
        type: "columns",
        props: { reverse: true },
        children: [],
      }),
    ).toContain("ws-columns--m-stack-reverse");
  });

  test("le mode éditeur marque les textes modifiables", () => {
    const html = renderBlock(context({ editor: true }), {
      id: "h",
      type: "hero",
      props: { title: "T", primaryLabel: "Go" },
    });
    expect(html).toContain('data-ws-edit="title"');
    expect(html).toContain('data-ws-edit="primaryLabel"');
    expect(
      renderBlock(context(), { id: "h", type: "hero", props: { title: "T" } }),
    ).not.toContain("data-ws-edit");
  });
});
