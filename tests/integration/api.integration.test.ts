// @vitest-environment node
import { unzipSync } from "fflate";
import sharp from "sharp";
import { beforeEach, describe, expect, test } from "vitest";
import {
  activate,
  contents,
  exportZip,
  identity,
  importZip,
  layouts,
  linkPreview,
  login,
  logout,
  me,
  media,
  menus,
  plugins,
  preview,
  revisions,
  stats,
  tags,
  types,
  users,
} from "~/server/api.server";
import { publicResponse } from "~/server/public.server";
import { sanitizeRich } from "~/server/sanitize.server";
import { isPrivateAddress, parsePreview } from "~/server/unfurl.server";
import { testEnv } from "../env";
import { ADMIN, call, freshSite, sessionFrom } from "./helpers";

let session = "";
let mails: ReturnType<typeof freshSite>["mails"];

beforeEach(async () => {
  ({ mails } = freshSite());
  const res = await call(login, { body: ADMIN });
  expect(res.status).toBe(200);
  session = sessionFrom(res.headers);
});

const page = async (path: string) => {
  const res = await publicResponse(new Request(`http://site.test${path}`));
  return { status: res?.status, html: (await res?.text()) ?? "" };
};

describe("authentification", () => {
  test("le premier administrateur vient de l'environnement", async () => {
    const res = await call(me, { cookie: session });
    expect(res.data.user).toMatchObject({ email: ADMIN.email, role: "admin" });
  });

  test("refuse un mauvais mot de passe et les requêtes anonymes", async () => {
    expect(
      (
        await call(login, {
          body: { ...ADMIN, password: testEnv.wrongPassword },
        })
      ).status,
    ).toBe(401);
    expect((await call(contents.list)).status).toBe(401);
  });

  test("refuse une écriture d'une autre origine", async () => {
    const res = await call(contents.create, {
      cookie: session,
      body: { typeId: "page" },
      origin: "http://evil.test",
    });
    expect(res.status).toBe(403);
  });

  test("invite un éditeur qui active son compte par e-mail", async () => {
    const invite = await call(users.invite, {
      cookie: session,
      body: { email: "edit@example.test", role: "editor", name: "Éd" },
    });
    expect(invite.status).toBe(201);
    expect(mails).toHaveLength(1);
    const token =
      new URL(mails[0].text.match(/https?:\S+/)?.[0] ?? "").searchParams.get(
        "token",
      ) ?? "";
    expect(
      (await call(activate, { body: { token, password: "court" } })).status,
    ).toBe(422);
    const ok = await call(activate, {
      body: { token, password: testEnv.newPassword },
    });
    expect(ok.status).toBe(200);
    const editor = sessionFrom(ok.headers);
    expect((await call(users.list, { cookie: editor })).status).toBe(403);
    expect((await call(contents.list, { cookie: editor })).status).toBe(200);
    expect(
      (
        await call(activate, {
          body: { token, password: testEnv.newPassword },
        })
      ).status,
    ).toBe(404);
  });

  test("garde au moins un administrateur actif", async () => {
    const list = await call(users.list, { cookie: session });
    const adminId = list.data.items[0].id;
    expect(
      (
        await call(users.remove, {
          method: "DELETE",
          cookie: session,
          params: { id: adminId },
        })
      ).status,
    ).toBe(409);
  });

  test("la déconnexion invalide la session", async () => {
    await call(logout, { method: "POST", cookie: session });
    expect((await call(me, { cookie: session })).data.user).toBeNull();
  });
});

describe("contenus et site public", () => {
  test("le site démarre avec une page d'accueil et un article", async () => {
    const home = await page("/");
    expect(home.status).toBe(200);
    expect(home.html).toContain("Votre site, simplement");
    expect(home.html).toContain("Premier article");
    const article = await page("/blog/premier-article");
    expect(article.html).toContain("<h1");
    expect((await page("/blog")).html).toContain("Premier article");
  });

  test("un brouillon n'est pas public, puis l'est une fois publié", async () => {
    const created = await call(contents.create, {
      cookie: session,
      body: { typeId: "page", title: "À propos" },
    });
    expect(created.status).toBe(201);
    expect(created.data.content.slug).toBe("a-propos");
    expect((await page("/a-propos")).status).toBe(404);
    const id = created.data.content.id;
    await call(contents.update, {
      method: "PATCH",
      cookie: session,
      params: { id },
      body: { status: "published" },
    });
    const published = await page("/a-propos");
    expect(published.status).toBe(200);
    expect(published.html).toMatch(/<h1[^>]*>À propos<\/h1>/);
  });

  test("filtre par type, statut et recherche", async () => {
    await call(contents.create, {
      cookie: session,
      body: { typeId: "article", title: "Recette de crêpes" },
    });
    const res = await call(contents.list, {
      cookie: session,
      path: "/api/contents?type=article&status=draft&q=crêpes",
    });
    expect(res.data.total).toBe(1);
    expect(res.data.items[0].title).toBe("Recette de crêpes");
  });

  test("nettoie le HTML et garantit des slugs uniques", async () => {
    const a = await call(contents.create, {
      cookie: session,
      body: {
        typeId: "article",
        title: "Doublon",
        body: '<p onclick="x()">ok<script>alert(1)</script></p>',
      },
    });
    const b = await call(contents.create, {
      cookie: session,
      body: { typeId: "article", title: "Doublon" },
    });
    expect(a.data.content.body).toBe("<p>ok</p>");
    expect(b.data.content.slug).toBe("doublon-2");
  });

  test("le cache public est invalidé par une modification", async () => {
    const before = await page("/");
    expect(before.html).not.toContain("Nouveau nom");
    const current = (await call(identity.get, { cookie: session })).data
      .identity;
    await call(identity.update, {
      method: "PUT",
      cookie: session,
      body: { ...current, name: "Nouveau nom" },
    });
    expect((await page("/")).html).toContain("Nouveau nom");
  });

  test("un type personnalisé avec son préfixe et son layout", async () => {
    const layout = await call(layouts.create, {
      cookie: session,
      body: { name: "Sobre", header: [], footer: [] },
    });
    const type = await call(types.create, {
      cookie: session,
      body: {
        name: "Projets",
        prefix: "projets",
        editor: "document",
        layoutId: layout.data.layout.id,
        template: [],
      },
    });
    expect(type.status).toBe(201);
    expect(type.data.type.template.length).toBeGreaterThan(0);
    const c = await call(contents.create, {
      cookie: session,
      body: {
        typeId: type.data.type.id,
        title: "Chantier",
        status: "published",
        body: "<p>Détails</p>",
      },
    });
    expect(c.status).toBe(201);
    const html = (await page("/projets/chantier")).html;
    expect(html).toContain("Détails");
    expect(html).not.toContain(`class="ws-header`);
    expect(
      (
        await call(types.create, {
          cookie: session,
          body: {
            name: "X",
            prefix: "admin",
            editor: "document",
            layoutId: null,
          },
        })
      ).status,
    ).toBe(409);
  });

  test("les menus alimentent la navigation", async () => {
    const list = await call(menus.list, { cookie: session });
    const main = list.data.items.find((m: { id: string }) => m.id === "main");
    await call(menus.update, {
      method: "PATCH",
      cookie: session,
      params: { id: "main" },
      body: {
        name: main.name,
        items: [...main.items, { id: "x", label: "Contact", url: "/contact" }],
      },
    });
    expect((await page("/")).html).toContain('href="/contact"');
  });

  test("l'aperçu de l'éditeur marque les blocs", async () => {
    const res = await call(preview, {
      cookie: session,
      body: {
        kind: "content",
        typeId: "page",
        blocks: [{ id: "h1", type: "heading", props: { text: "Aperçu" } }],
      },
    });
    expect(res.data).toContain('data-ws-block="h1"');
    expect(res.data).toContain("Aperçu");
  });
});

describe("médias", () => {
  test("génère des variantes webp et les sert", async () => {
    const png = await sharp({
      create: { width: 1000, height: 500, channels: 3, background: "#38a8ed" },
    })
      .png()
      .toBuffer();
    const form = new FormData();
    form.append(
      "file",
      new File([new Uint8Array(png)], "bleu.png", { type: "image/png" }),
    );
    const res = await call(media.upload, { cookie: session, form });
    expect(res.status).toBe(201);
    const item = res.data.items[0];
    expect(item.width).toBe(1000);
    expect(item.variants.map((v: { width: number }) => v.width)).toEqual([
      320, 640, 960, 1000,
    ]);
    const file = await publicResponse(
      new Request(`http://site.test/media/${item.id}/w320.webp`),
    );
    expect(file?.headers.get("content-type")).toBe("image/webp");
    expect(
      (
        await publicResponse(
          new Request(
            `http://site.test/media/${item.id}/..%2F..%2Fsite.sqlite`,
          ),
        )
      )?.status,
    ).toBe(404);
  });

  test("refuse un SVG actif et un format inconnu", async () => {
    const form = new FormData();
    form.append(
      "file",
      new File(['<svg onload="alert(1)"></svg>'], "x.svg", {
        type: "image/svg+xml",
      }),
    );
    expect((await call(media.upload, { cookie: session, form })).status).toBe(
      422,
    );
    const other = new FormData();
    other.append(
      "file",
      new File(["x"], "x.exe", { type: "application/x-msdownload" }),
    );
    expect(
      (await call(media.upload, { cookie: session, form: other })).status,
    ).toBe(422);
  });
});

describe("export et import", () => {
  test("exporte base, médias et site statique puis restaure", async () => {
    const res = await call(exportZip, { cookie: session });
    expect(res.headers.get("content-type")).toBe("application/zip");
    const zip = new Uint8Array(await res.response.arrayBuffer());
    const entries = unzipSync(zip);
    expect(Object.keys(entries)).toEqual(
      expect.arrayContaining([
        "site.sqlite",
        "manifest.json",
        "static/index.html",
        "static/blog/premier-article/index.html",
      ]),
    );

    await call(contents.create, {
      cookie: session,
      body: { typeId: "page", title: "Après export", status: "published" },
    });
    expect((await page("/apres-export")).status).toBe(200);

    const form = new FormData();
    form.append(
      "file",
      new File([zip], "site.zip", { type: "application/zip" }),
    );
    const restored = await call(importZip, { cookie: session, form });
    expect(restored.status).toBe(200);
    expect((await page("/apres-export")).status).toBe(404);
    expect((await page("/")).status).toBe(200);
  });

  test("refuse une archive étrangère", async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array([1, 2, 3])], "x.zip"));
    expect((await call(importZip, { cookie: session, form })).status).toBe(422);
  });
});

describe("champs personnalisés, tags et adresses", () => {
  const field = (
    kind: string,
    label: string,
    extra: Record<string, unknown> = {},
  ) => ({
    id: `f-${label}`,
    type: `field-${kind}`,
    props: { label, ...extra },
  });

  const projectType = async () => {
    const created = await call(types.create, {
      cookie: session,
      body: {
        name: "Projets",
        prefix: "projets",
        editor: "document",
        layoutId: null,
      },
    });
    expect(created.status).toBe(201);
    const res = await call(types.update, {
      method: "PATCH",
      cookie: session,
      params: { id: created.data.type.id },
      body: {
        template: [
          {
            id: "s",
            type: "section",
            props: {},
            children: [
              { id: "t", type: "content-title", props: {} },
              field("text", "Client", { required: true, showLabel: true }),
              field("number", "Budget"),
              field("select", "Statut", { options: "En cours, Livré" }),
              field("url", "Site"),
              field("richtext", "Description"),
            ],
          },
        ],
      },
    });
    expect(res.status).toBe(200);
    return res.data.type;
  };

  test("un type définit ses champs, nommés et typés", async () => {
    const type = await projectType();
    expect(type.fields.map((f: { key: string }) => f.key)).toEqual([
      "client",
      "budget",
      "statut",
      "site",
      "description",
    ]);
    expect(type.hasBody).toBe(false);
  });

  test("les valeurs sont validées et un champ obligatoire bloque la publication", async () => {
    const type = await projectType();
    const created = await call(contents.create, {
      cookie: session,
      body: {
        typeId: type.id,
        title: "Refonte",
        data: {
          client: "",
          budget: "1200",
          statut: "Inconnu",
          site: "javascript:alert(1)",
          description: "<p>ok<script>x</script></p>",
          intrus: 1,
        },
      },
    });
    expect(created.status).toBe(201);
    expect(created.data.content.data).toEqual({
      client: "",
      budget: 1200,
      statut: "",
      site: "",
      description: "<p>ok</p>",
    });
    const id = created.data.content.id;
    const refused = await call(contents.update, {
      method: "PATCH",
      cookie: session,
      params: { id },
      body: { status: "published", data: { client: "" } },
    });
    expect(refused.status).toBe(422);
    expect(refused.data.error).toContain("Client");
    const ok = await call(contents.update, {
      method: "PATCH",
      cookie: session,
      params: { id },
      body: { status: "published", data: { client: "ACME", statut: "Livré" } },
    });
    expect(ok.status).toBe(200);
  });

  test("un modèle affiche les champs du contenu", async () => {
    const type = await projectType();
    await call(contents.create, {
      cookie: session,
      body: {
        typeId: type.id,
        title: "Chantier",
        status: "published",
        data: { client: "Atelier Nord" },
      },
    });
    const html = (await page("/projets/chantier")).html;
    expect(html).toContain("Atelier Nord");
    expect(html).toContain('<p class="ws-field__label">Client</p>');
  });

  test("renommer un champ garde sa clé et les valeurs saisies", async () => {
    const type = await projectType();
    await call(contents.create, {
      cookie: session,
      body: {
        typeId: type.id,
        title: "Stable",
        status: "published",
        data: { client: "Garde" },
      },
    });
    const template = (
      await call(types.get, { cookie: session, params: { id: type.id } })
    ).data.type.template;
    template[0].children[1].props.label = "Commanditaire";
    const res = await call(types.update, {
      method: "PATCH",
      cookie: session,
      params: { id: type.id },
      body: { template },
    });
    expect(res.data.type.fields[0]).toMatchObject({
      key: "client",
      label: "Commanditaire",
    });
    expect((await page("/projets/stable")).html).toContain("Garde");
  });

  test("les tags se créent depuis un contenu, filtrent et ont leur page", async () => {
    const a = await call(contents.create, {
      cookie: session,
      body: {
        typeId: "article",
        title: "Recette",
        status: "published",
        tags: ["Cuisine", "Hiver"],
      },
    });
    await call(contents.create, {
      cookie: session,
      body: {
        typeId: "article",
        title: "Rando",
        status: "published",
        tags: ["hiver"],
      },
    });
    expect(a.data.content.tags.map((t: { name: string }) => t.name)).toEqual([
      "Cuisine",
      "Hiver",
    ]);
    const list = await call(tags.list, { cookie: session });
    const hiver = list.data.items.find(
      (t: { name: string }) => t.name === "Hiver",
    );
    expect(hiver.count).toBe(2);
    const filtered = await call(contents.list, {
      cookie: session,
      path: `/api/contents?tag=${hiver.id}`,
    });
    expect(filtered.data.total).toBe(2);
    const archive = await page("/tag/hiver");
    expect(archive.status).toBe(200);
    expect(archive.html).toContain("Rando");
    await call(tags.update, {
      method: "PATCH",
      cookie: session,
      params: { id: hiver.id },
      body: { slug: "saison-froide" },
    });
    expect((await page("/tag/saison-froide")).html).toContain("Recette");
    expect((await page("/blog/recette")).html).toContain(
      'href="/tag/saison-froide"',
    );
  });

  test("changer l'adresse d'un contenu publié redirige l'ancienne en 301", async () => {
    const created = await call(contents.create, {
      cookie: session,
      body: { typeId: "page", title: "Tarifs", status: "published" },
    });
    const id = created.data.content.id;
    await call(contents.update, {
      method: "PATCH",
      cookie: session,
      params: { id },
      body: { slug: "prix" },
    });
    const res = await publicResponse(new Request("http://site.test/tarifs"));
    expect(res?.status).toBe(301);
    expect(res?.headers.get("location")).toBe("/prix");
    expect((await page("/prix")).status).toBe(200);
  });

  test("l'aperçu de layout rend l'en-tête et le pied modifiables, pas le contenu", async () => {
    const res = await call(preview, {
      cookie: session,
      body: {
        kind: "layout",
        header: [{ id: "h", type: "heading", props: { text: "Haut" } }],
        footer: [],
      },
    });
    expect(res.data).toContain('data-ws-zone="header"');
    expect(res.data).toContain('data-ws-zone="footer"');
    expect(res.data).toContain('data-ws-block="h"');
    expect(res.data).not.toContain('data-ws-block="preview-ph"');
  });
});

describe("texte long saisi dans l'éditeur", () => {
  test("le HTML est nettoyé et rendu, l'ancien texte brut reste affiché", async () => {
    const created = await call(types.create, {
      cookie: session,
      body: {
        name: "Notes",
        prefix: "notes",
        editor: "document",
        layoutId: null,
      },
    });
    const id = created.data.type.id;
    await call(types.update, {
      method: "PATCH",
      cookie: session,
      params: { id },
      body: {
        template: [
          {
            id: "s",
            type: "section",
            props: {},
            children: [
              {
                id: "f",
                type: "field-textarea",
                props: { label: "Résumé long" },
              },
            ],
          },
        ],
      },
    });
    const rich = await call(contents.create, {
      cookie: session,
      body: {
        typeId: id,
        title: "Riche",
        status: "published",
        data: {
          resume_long: "<p>Un <strong>mot</strong><script>x</script></p>",
        },
      },
    });
    expect(rich.data.content.data.resume_long).toBe(
      "<p>Un <strong>mot</strong></p>",
    );
    expect((await page("/notes/riche")).html).toContain(
      "<p>Un <strong>mot</strong></p>",
    );
    await call(contents.create, {
      cookie: session,
      body: {
        typeId: id,
        title: "Brut",
        status: "published",
        data: { resume_long: "a < b\nligne" },
      },
    });
    expect((await page("/notes/brut")).html).toContain("a &lt; b<br>ligne");
  });
});

describe("multilingue", () => {
  const enable = (languages = [{ code: "en", label: "" }]) =>
    call(plugins.update, {
      method: "PUT",
      cookie: session,
      body: { i18n: { enabled: true, languages } },
    });

  test("l'extension refuse un code qui masquerait une adresse du site", async () => {
    const res = await enable([{ code: "tag", label: "" }]);
    expect(res.status).toBe(409);
    const ok = await enable();
    expect(ok.status).toBe(200);
    expect(ok.data.plugins.i18n.languages).toEqual([
      { code: "en", label: "English" },
    ]);
  });

  test("une traduction garde l'adresse, préfixée par sa langue, avec hreflang", async () => {
    await enable();
    const created = await call(contents.create, {
      cookie: session,
      body: { typeId: "page", title: "Contact", status: "published" },
    });
    const id = created.data.content.id;
    const translated = await call(contents.translate, {
      cookie: session,
      params: { id },
      body: { lang: "en" },
    });
    expect(translated.status).toBe(201);
    const en = translated.data.content;
    expect(en).toMatchObject({
      lang: "en",
      translationOf: id,
      slug: "contact",
    });
    expect(en.status).toBe("draft");
    // Brouillon : invisible en public.
    expect((await page("/en/contact")).status).toBe(404);
    await call(contents.update, {
      method: "PATCH",
      cookie: session,
      params: { id: en.id },
      body: { title: "Contact us", status: "published" },
    });
    const html = (await page("/en/contact")).html;
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("Contact us");
    expect(html).toContain('hreflang="en" href="http://site.test/en/contact"');
    expect(html).toContain('hreflang="fr" href="http://site.test/contact"');
    // Une seconde demande renvoie la traduction existante.
    const again = await call(contents.translate, {
      cookie: session,
      params: { id },
      body: { lang: "en" },
    });
    expect(again.data.content.id).toBe(en.id);
    const got = await call(contents.get, { cookie: session, params: { id } });
    expect(got.data.translations.map((t: { lang: string }) => t.lang)).toEqual([
      "",
      "en",
    ]);
    const list = await call(contents.list, {
      cookie: session,
      path: "/api/contents?lang=en",
    });
    expect(list.data.items.map((c: { id: string }) => c.id)).toEqual([en.id]);
  });

  test("l'accueil traduit est servi sous /en et les listes suivent la langue", async () => {
    await enable();
    const home = (await call(identity.get, { cookie: session })).data.identity
      .homeId;
    const t = await call(contents.translate, {
      cookie: session,
      params: { id: home },
      body: { lang: "en" },
    });
    await call(contents.update, {
      method: "PATCH",
      cookie: session,
      params: { id: t.data.content.id },
      body: { title: "Welcome", status: "published" },
    });
    expect((await page("/en")).html).toContain("Welcome");
    expect((await page("/")).html).not.toContain("Welcome");
    // Langue inactive : refusée, et les adresses /de/ ne sont pas des langues.
    const refused = await call(contents.translate, {
      cookie: session,
      params: { id: home },
      body: { lang: "de" },
    });
    expect(refused.status).toBe(422);
  });

  test("extension coupée : les traductions ne sont plus servies", async () => {
    await enable();
    const created = await call(contents.create, {
      cookie: session,
      body: { typeId: "page", title: "Aide", status: "published" },
    });
    const en = await call(contents.translate, {
      cookie: session,
      params: { id: created.data.content.id },
      body: { lang: "en" },
    });
    await call(contents.update, {
      method: "PATCH",
      cookie: session,
      params: { id: en.data.content.id },
      body: { status: "published" },
    });
    expect((await page("/en/aide")).status).toBe(200);
    await call(plugins.update, {
      method: "PUT",
      cookie: session,
      body: {
        i18n: { enabled: false, languages: [{ code: "en", label: "" }] },
      },
    });
    expect((await page("/en/aide")).status).toBe(404);
  });
});

describe("titre et description mutualisés", () => {
  test("la description sert de meta description", async () => {
    await call(contents.create, {
      cookie: session,
      body: {
        typeId: "page",
        title: "Atelier",
        excerpt: "Cours de poterie le samedi.",
        status: "published",
      },
    });
    const html = (await page("/atelier")).html;
    expect(html).toContain(
      '<meta name="description" content="Cours de poterie le samedi.">',
    );
    expect(html).toContain("<title>Atelier | ");
  });
});

describe("texte riche : vidéos et liens enrichis", () => {
  test("seules les vidéos YouTube passent, les cartes de lien sont conservées", () => {
    const html = sanitizeRich(
      '<div data-youtube-video=""><iframe src="https://www.youtube-nocookie.com/embed/abc" onload="x()"></iframe></div>' +
        '<iframe src="https://evil.example/x"></iframe>' +
        '<a class="ws-link-card ws-link-card--card pirate" href="https://a.fr" data-link-card="" data-title="A" onclick="x()"><span class="ws-link-card__title">A</span></a>',
    );
    expect(html).toContain('src="https://www.youtube-nocookie.com/embed/abc"');
    expect(html).not.toContain("evil.example");
    expect(html).not.toContain("onload");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("pirate");
    expect(html).toContain('class="ws-link-card ws-link-card--card"');
  });

  test("l'aperçu de lien lit Open Graph et refuse les adresses internes", async () => {
    const preview = parsePreview(
      `<html><head><title>Repli</title><meta property="og:title" content="Titre &amp; co"><meta name="description" content="Desc"><meta property="og:image" content="/img.png"></head></html>`,
      "https://www.exemple.fr/page",
    );
    expect(preview).toMatchObject({
      title: "Titre & co",
      description: "Desc",
      image: "https://www.exemple.fr/img.png",
      site: "exemple.fr",
    });
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "192.168.0.4",
      "169.254.169.254",
      "::1",
      "::ffff:127.0.0.1",
      "fd00::1",
    ])
      expect(isPrivateAddress(ip)).toBe(true);
    expect(isPrivateAddress("93.184.216.34")).toBe(false);
    for (const url of [
      "http://127.0.0.1/",
      "http://localhost:3000/",
      "file:///etc/passwd",
      "http://[::1]/",
    ]) {
      const res = await call(linkPreview, {
        cookie: session,
        path: `/api/link-preview?url=${encodeURIComponent(url)}`,
      });
      expect(res.status).toBe(422);
    }
  });
});

describe("le type est la mise en page, le contenu remplit les champs", () => {
  test("le modèle du type affiche les valeurs du contenu", async () => {
    const created = await call(types.create, {
      cookie: session,
      body: {
        name: "Fiches",
        prefix: "fiches",
        layoutId: null,
        template: [
          { id: "t", type: "content-title", props: {} },
          { id: "f", type: "field-number", props: { label: "Prix" } },
        ],
      },
    });
    const type = created.data.type;
    expect(type.fields).toEqual([
      { key: "prix", label: "Prix", type: "number" },
    ]);
    expect(type.hasBody).toBe(false);
    const content = await call(contents.create, {
      cookie: session,
      body: {
        typeId: type.id,
        title: "Vase",
        status: "published",
        data: { prix: "42", inconnu: "ignoré" },
      },
    });
    expect(content.data.content.data).toEqual({ prix: 42 });
    const html = (await page("/fiches/vase")).html;
    expect(html).toMatch(/<h1[^>]*>Vase<\/h1>/);
    expect(html).toContain("42");
  });

  test("Page ne se supprime pas ; un autre type vide, si", async () => {
    expect(
      (await call(types.remove, { cookie: session, params: { id: "page" } }))
        .status,
    ).toBe(409);
    const articles = (
      await call(contents.list, {
        cookie: session,
        path: "/api/contents?type=article",
      })
    ).data.items;
    for (const c of articles)
      await call(contents.remove, { cookie: session, params: { id: c.id } });
    const res = await call(types.remove, {
      cookie: session,
      params: { id: "article" },
    });
    expect(res.status).toBe(200);
  });
});

describe("révisions", () => {
  const history = async (entity: string, id: string) =>
    (
      await call(revisions.list, {
        cookie: session,
        path: `/api/revisions?entity=${entity}&id=${id}`,
      })
    ).data.items;

  test("chaque action crée une révision, avec son auteur ; une version se restaure", async () => {
    const created = await call(contents.create, {
      cookie: session,
      body: { typeId: "page", title: "Version 1" },
    });
    const id = created.data.content.id;
    const update = (body: unknown) =>
      call(contents.update, {
        method: "PATCH",
        cookie: session,
        params: { id },
        body,
      });
    await update({ title: "Version 2" });
    // Un enregistrement sans changement n'ajoute pas de révision.
    await update({ title: "Version 2" });
    const items = await history("content", id);
    expect(items.map((r: { action: string }) => r.action)).toEqual([
      "update",
      "create",
    ]);
    expect(items[0]).toMatchObject({
      label: "Version 2",
      userName: "Administrateur",
    });
    const restored = await call(revisions.restore, {
      cookie: session,
      params: { id: items[1].id },
    });
    expect(restored.status).toBe(200);
    const got = await call(contents.get, { cookie: session, params: { id } });
    expect(got.data.content.title).toBe("Version 1");
    expect((await history("content", id))[0].action).toBe("restore");
  });

  test("un contenu supprimé se restaure avec son identifiant et ses tags", async () => {
    const created = await call(contents.create, {
      cookie: session,
      body: {
        typeId: "article",
        title: "Éphémère",
        tags: ["Brouillons"],
        status: "published",
      },
    });
    const id = created.data.content.id;
    await call(contents.remove, { cookie: session, params: { id } });
    expect((await page("/blog/ephemere")).status).toBe(404);
    const deleted = (await call(revisions.deleted, { cookie: session })).data
      .items;
    const entry = deleted.find((r: { entityId: string }) => r.entityId === id);
    expect(entry).toMatchObject({ entity: "content", label: "Éphémère" });
    await call(revisions.restore, {
      cookie: session,
      params: { id: entry.id },
    });
    const got = await call(contents.get, { cookie: session, params: { id } });
    expect(got.data.content.tags.map((t: { name: string }) => t.name)).toEqual([
      "Brouillons",
    ]);
    expect((await page("/blog/ephemere")).status).toBe(200);
    // Restauré : il ne figure plus parmi les éléments supprimés.
    const after = (await call(revisions.deleted, { cookie: session })).data
      .items;
    expect(after.some((r: { entityId: string }) => r.entityId === id)).toBe(
      false,
    );
  });

  test("un tag supprimé retrouve ses contenus", async () => {
    const created = await call(contents.create, {
      cookie: session,
      body: { typeId: "article", title: "Tarte", tags: ["Desserts"] },
    });
    const tag = created.data.content.tags[0];
    await call(tags.remove, { cookie: session, params: { id: tag.id } });
    const entry = (
      await call(revisions.deleted, { cookie: session })
    ).data.items.find((r: { entityId: string }) => r.entityId === tag.id);
    await call(revisions.restore, {
      cookie: session,
      params: { id: entry.id },
    });
    const got = await call(contents.get, {
      cookie: session,
      params: { id: created.data.content.id },
    });
    expect(got.data.content.tags).toEqual([tag]);
  });

  test("l'identité, les menus et les layouts ont leur historique", async () => {
    const before = (await call(identity.get, { cookie: session })).data
      .identity;
    await call(identity.update, {
      method: "PUT",
      cookie: session,
      body: { ...before, name: "Nouveau nom" },
    });
    const items = await history("identity", "identity");
    expect(items[0].label).toBe("Nouveau nom");
    const menu = await call(menus.create, {
      cookie: session,
      body: { name: "Pied", items: [] },
    });
    expect((await history("menu", menu.data.menu.id))[0].action).toBe("create");
  });

  test("Données : tailles et nettoyage des vieilles révisions", async () => {
    const res = await call(stats, { cookie: session });
    expect(res.data.stats.database).toBeGreaterThan(0);
    expect(res.data.stats.revisions).toBeGreaterThan(0);
    const purge = await call(revisions.purge, {
      method: "DELETE",
      cookie: session,
      path: "/api/revisions?days=1",
    });
    // Tout date d'aujourd'hui : rien n'est supprimé.
    expect(purge.data.deleted).toBe(0);
    const invalid = await call(revisions.purge, {
      method: "DELETE",
      cookie: session,
      path: "/api/revisions?days=0",
    });
    expect(invalid.status).toBe(422);
  });
});

describe("page de liste d'un type", () => {
  const publish = (title: string, data: Record<string, unknown> = {}) =>
    call(contents.create, {
      cookie: session,
      body: { typeId: "evenements", title, status: "published", data },
    });

  test("cartes dessinées par le modèle de liste, pagination et 404 au-delà", async () => {
    await call(types.create, {
      cookie: session,
      body: {
        name: "Événements",
        prefix: "agenda",
        layoutId: null,
        template: [
          { id: "t", type: "content-title", props: {} },
          { id: "f", type: "field-text", props: { label: "Lieu" } },
        ],
      },
    });
    // Sans modèle de liste : liste par défaut, ouverte dans l'éditeur.
    const fresh = await call(types.get, {
      cookie: session,
      params: { id: "evenements" },
    });
    expect(
      fresh.data.type.archiveTemplate[0].children.map(
        (b: { type: string }) => b.type,
      ),
    ).toEqual(["archive-title", "archive-list"]);
    await call(types.update, {
      method: "PATCH",
      cookie: session,
      params: { id: "evenements" },
      body: {
        archiveTemplate: [
          { id: "h", type: "archive-title", props: {} },
          {
            id: "l",
            type: "archive-list",
            props: { perPage: 2, order: "title", pagination: "numbers" },
            children: [
              { id: "c1", type: "content-title", props: {} },
              { id: "c2", type: "content-field", props: { field: "lieu" } },
            ],
          },
        ],
      },
    });
    await publish("Concert", { lieu: "Salle des fêtes" });
    await publish("Atelier", { lieu: "Médiathèque" });
    await publish("Bal");
    const first = (await page("/agenda")).html;
    expect(first).toMatch(/<h1[^>]*>Événements<\/h1>/);
    // Ordre alphabétique, 2 par page : Atelier, Bal.
    expect(first).toContain('<a href="/agenda/atelier">Atelier</a>');
    expect(first).toContain('<a href="/agenda/bal">Bal</a>');
    expect(first).not.toContain("Concert");
    expect(first).toContain("Médiathèque");
    expect(first).toContain('href="/agenda/page/2"');
    const second = await page("/agenda/page/2");
    expect(second.status).toBe(200);
    expect(second.html).toContain("Concert");
    expect(second.html).toContain("Salle des fêtes");
    expect(second.html).toContain("<title>Événements | page 2");
    expect(second.html).toContain('aria-current="page">2</a>');
    expect((await page("/agenda/page/3")).status).toBe(404);
  });

  test("la liste par défaut des articles et l'aperçu de l'éditeur", async () => {
    const blog = (await page("/blog")).html;
    expect(blog).toContain(
      '<a href="/blog/premier-article">Premier article</a>',
    );
    const res = await call(preview, {
      cookie: session,
      body: {
        kind: "archive",
        typeId: "article",
        blocks: [
          {
            id: "l",
            type: "archive-list",
            props: {},
            children: [{ id: "c", type: "content-title", props: {} }],
          },
        ],
      },
    });
    expect(res.data).toContain('data-ws-block="l"');
    expect(res.data).toContain("Premier article");
  });
});
