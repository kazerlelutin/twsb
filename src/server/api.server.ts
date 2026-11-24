import { z } from "zod";
import type { Block } from "../features/blocks/block.type";
import { blockId } from "../features/blocks/catalog";
import { slugify } from "../features/render/html";
import { renderDocument } from "../features/render/page.render";
import {
  type ContentField,
  LANGUAGE_NAMES,
  type MenuItem,
} from "../features/site/site.type";
import { exportSite, ImportError, importSite } from "./export.server";
import {
  cleanData,
  cleanFieldDefs,
  deriveFields,
  withFieldBlocks,
} from "./fields.server";
import {
  api,
  body,
  clearSessionCookie,
  cookie,
  currentUser,
  HttpError,
  json,
  query,
  requireUser,
  SESSION_COOKIE,
  sessionCookie,
} from "./http.server";
import { accountMail, activationUrl, sendMail } from "./mail.server";
import { MediaError, removeMedia, storeUpload } from "./media.server";
import { passwordProblem, verifyPassword } from "./password.server";
import {
  type ContentFilter,
  contentPath,
  deleteContent,
  deleteLayout,
  deleteMenu,
  deleteTag,
  deleteType,
  getContent,
  getIdentity,
  getLayout,
  getMedia,
  getMenu,
  getPlugins,
  getType,
  listContents,
  listLayouts,
  listMedia,
  listMenus,
  listTags,
  listTypes,
  saveContent,
  saveIdentity,
  saveLayout,
  saveMenu,
  savePlugins,
  saveType,
  translationIn,
  translationsOf,
  typeByPrefix,
  uniqueSlug,
  updateMedia,
  updateTag,
} from "./repo.server";
import { sanitizeBlocks, sanitizeRich } from "./sanitize.server";
import {
  DEFAULT_TEMPLATE,
  layoutFor,
  renderContent,
  renderContext,
  siteLanguages,
  TAG_PREFIX,
} from "./site.server";
import { UnfurlError, unfurl } from "./unfurl.server";
import {
  activateUser,
  activeAdmins,
  createSession,
  deleteUser,
  destroySession,
  getUser,
  inviteUser,
  listUsers,
  renewToken,
  updateUser,
  userByToken,
  userRowByEmail,
} from "./users.server";

const blocks = z.array(z.any()).transform((value) => sanitizeBlocks(value));
const blocksOrEmpty = z
  .array(z.any())
  .default([])
  .transform((value) => sanitizeBlocks(value));
const id = z.string().min(1).max(64);
const slug = z
  .string()
  .max(80)
  .transform((v) => slugify(v));

/* Authentification */
export const login = api(async ({ request }) => {
  const { email, password } = await body(
    request,
    z.object({ email: z.string().email(), password: z.string().min(1) }),
  );
  await currentUser(request);
  const row = userRowByEmail(email);
  const ok =
    row &&
    row.status === "active" &&
    (await verifyPassword(password, row.password_hash));
  if (!ok || !row) throw new HttpError(401, "Identifiants incorrects.");
  const session = createSession(row.id);
  return json({ user: getUser(row.id) }, 200, {
    "set-cookie": sessionCookie(request, session.token, session.maxAge),
  });
});

export const logout = api(async ({ request }) => {
  const token = cookie(request, SESSION_COOKIE);
  if (token) destroySession(token);
  return json({ ok: true }, 200, { "set-cookie": clearSessionCookie(request) });
});

export const me = api(async ({ request }) =>
  json({ user: (await currentUser(request)) ?? null }),
);

export const tokenInfo = api(async ({ request }) => {
  const user = userByToken(query(request).get("token") ?? "");
  if (!user) throw new HttpError(404, "Lien expiré ou invalide.");
  return json({ email: user.email, name: user.name });
});

export const activate = api(async ({ request }) => {
  const input = await body(
    request,
    z.object({
      token: z.string().min(10),
      password: z.string(),
      name: z.string().max(120).optional(),
    }),
  );
  const problem = passwordProblem(input.password);
  if (problem) throw new HttpError(422, problem);
  const user = await activateUser(input.token, input.password, input.name);
  if (!user) throw new HttpError(404, "Lien expiré ou invalide.");
  const session = createSession(user.id);
  return json({ user }, 200, {
    "set-cookie": sessionCookie(request, session.token, session.maxAge),
  });
});

export const forgot = api(async ({ request }) => {
  const { email } = await body(
    request,
    z.object({ email: z.string().email() }),
  );
  const row = userRowByEmail(email);
  if (row && row.status !== "disabled")
    await sendMail(accountMail(row.email, renewToken(row.id), "reset"));
  return json({ ok: true });
});

/* Utilisateurs */
const roleSchema = z.enum(["admin", "editor"]);

export const users = {
  list: api(async ({ request }) => {
    await requireUser(request, "admin");
    return json({ items: listUsers() });
  }),
  invite: api(async ({ request }) => {
    await requireUser(request, "admin");
    const input = await body(
      request,
      z.object({
        email: z.string().email(),
        name: z.string().max(120).default(""),
        role: roleSchema,
      }),
    );
    if (userRowByEmail(input.email))
      throw new HttpError(409, "Cette adresse a déjà un compte.");
    const { user, token } = inviteUser(input.email, input.role, input.name);
    const sent = await sendMail(accountMail(user.email, token, "invite"));
    return json(
      { user, sent, link: sent ? undefined : activationUrl(token) },
      201,
    );
  }),
  resend: api(async ({ request, params }) => {
    await requireUser(request, "admin");
    const user = getUser(params.id);
    if (!user) throw new HttpError(404, "Compte introuvable.");
    const token = renewToken(user.id);
    const sent = await sendMail(
      accountMail(
        user.email,
        token,
        user.status === "pending" ? "invite" : "reset",
      ),
    );
    return json({ sent, link: sent ? undefined : activationUrl(token) });
  }),
  update: api(async ({ request, params }) => {
    const me = await requireUser(request, "admin");
    const patch = await body(
      request,
      z.object({
        name: z.string().max(120).optional(),
        role: roleSchema.optional(),
        status: z.enum(["active", "disabled"]).optional(),
      }),
    );
    const target = getUser(params.id);
    if (!target) throw new HttpError(404, "Compte introuvable.");
    const losesAdmin =
      target.role === "admin" &&
      target.status === "active" &&
      (patch.role === "editor" || patch.status === "disabled");
    if (losesAdmin && activeAdmins() <= 1)
      throw new HttpError(409, "Il faut au moins un administrateur actif.");
    if (target.id === me.id && patch.status === "disabled")
      throw new HttpError(409, "Impossible de désactiver votre propre compte.");
    return json({ user: updateUser(params.id, patch) });
  }),
  remove: api(async ({ request, params }) => {
    const me = await requireUser(request, "admin");
    const target = getUser(params.id);
    if (!target) throw new HttpError(404, "Compte introuvable.");
    if (target.id === me.id)
      throw new HttpError(409, "Impossible de supprimer votre propre compte.");
    if (
      target.role === "admin" &&
      target.status === "active" &&
      activeAdmins() <= 1
    )
      throw new HttpError(409, "Il faut au moins un administrateur actif.");
    deleteUser(params.id);
    return json({ ok: true });
  }),
};

/* Contenus */
const contentInput = z.object({
  typeId: id.optional(),
  title: z.string().max(200).optional(),
  slug: slug.optional(),
  status: z.enum(["draft", "published"]).optional(),
  excerpt: z.string().max(500).optional(),
  body: z
    .string()
    .max(2_000_000)
    .transform((v) => sanitizeRich(v))
    .optional(),
  blocks: blocks.optional(),
  coverId: z.string().max(64).nullable().optional(),
  seoTitle: z.string().max(200).optional(),
  seoDescription: z.string().max(400).optional(),
  data: z.record(z.unknown()).optional(),
  tags: z.array(z.string().max(60)).max(30).optional(),
});

/** Les valeurs des champs sont validées selon le type ; publier exige les champs obligatoires. */
function withData<
  T extends { data?: Record<string, unknown>; status?: string },
>(input: T, typeId: string, currentStatus?: string) {
  const type = getType(typeId);
  if (!type) throw new HttpError(404, "Type introuvable.");
  if (input.data === undefined) return input;
  const { data, missing } = cleanData(type.fields, input.data);
  const publishing = (input.status ?? currentStatus) === "published";
  if (publishing && missing.length)
    throw new HttpError(422, `Champs obligatoires : ${missing.join(", ")}.`);
  return { ...input, data };
}

export const contents = {
  list: api(async ({ request }) => {
    await requireUser(request);
    const q = query(request);
    const filter: ContentFilter = {
      typeId: q.get("type") || undefined,
      status: (q.get("status") as ContentFilter["status"]) || undefined,
      q: q.get("q") || undefined,
      authorId: q.get("author") || undefined,
      tagId: q.get("tag") || undefined,
      // « main » désigne la langue principale (stockée vide).
      lang: q.has("lang")
        ? q.get("lang") === "main"
          ? ""
          : (q.get("lang") ?? "")
        : undefined,
      sort: (q.get("sort") as ContentFilter["sort"]) || undefined,
      limit: Math.min(200, Number(q.get("limit")) || 50),
      offset: Number(q.get("offset")) || 0,
    };
    return json(listContents(filter));
  }),
  create: api(async ({ request }) => {
    const user = await requireUser(request);
    const input = await body(request, contentInput.extend({ typeId: id }));
    const type = getType(input.typeId);
    if (!type) throw new HttpError(404, "Type introuvable.");
    const title = input.title?.trim() || "Sans titre";
    const content = saveContent(
      undefined,
      {
        ...withData(input, type.id),
        title,
        slug: uniqueSlug(type.id, input.slug || slugify(title)),
        blocks:
          input.blocks ?? (type.editor === "builder" ? starterBlocks() : []),
      },
      user.id,
    );
    return json({ content }, 201);
  }),
  get: api(async ({ request, params }) => {
    await requireUser(request);
    const content = getContent(params.id);
    if (!content) throw new HttpError(404, "Contenu introuvable.");
    return json({
      content,
      url: contentPath(content.id),
      translations: translationsOf(content.id),
    });
  }),
  /** Crée (ou retrouve) la version d'un contenu dans une autre langue. */
  translate: api(async ({ request, params }) => {
    const user = await requireUser(request);
    const { lang } = await body(
      request,
      z.object({ lang: z.string().max(10) }),
    );
    const current = getContent(params.id);
    if (!current) throw new HttpError(404, "Contenu introuvable.");
    if (!siteLanguages().some((l) => l.code === lang))
      throw new HttpError(422, "Langue inactive.");
    const existing = translationIn(current.id, lang);
    if (existing) return json({ content: getContent(existing.id) });
    const source = current.translationOf
      ? (getContent(current.translationOf) ?? current)
      : current;
    const {
      id: _id,
      createdAt: _c,
      updatedAt: _u,
      authorName: _a,
      tags,
      ...rest
    } = source;
    const content = saveContent(
      undefined,
      {
        ...rest,
        tags: tags.map((t) => t.name),
        lang,
        translationOf: lang ? source.id : null,
        slug: uniqueSlug(source.typeId, source.slug, undefined, lang),
        status: "draft",
        publishedAt: null,
      },
      user.id,
    );
    return json({ content }, 201);
  }),
  update: api(async ({ request, params }) => {
    await requireUser(request);
    const current = getContent(params.id);
    if (!current) throw new HttpError(404, "Contenu introuvable.");
    const input = await body(request, contentInput);
    const typeId = input.typeId ?? current.typeId;
    if (!getType(typeId)) throw new HttpError(404, "Type introuvable.");
    const nextSlug =
      input.slug !== undefined
        ? uniqueSlug(
            typeId,
            input.slug || slugify(input.title ?? current.title),
            current.id,
            current.lang,
          )
        : current.slug;
    const content = saveContent(current.id, {
      ...withData(input, typeId, current.status),
      typeId,
      slug: nextSlug,
    });
    return json({ content, url: contentPath(content.id) });
  }),
  duplicate: api(async ({ request, params }) => {
    const user = await requireUser(request);
    const current = getContent(params.id);
    if (!current) throw new HttpError(404, "Contenu introuvable.");
    const {
      id: _id,
      createdAt: _c,
      updatedAt: _u,
      authorName: _a,
      tags,
      ...rest
    } = current;
    const content = saveContent(
      undefined,
      {
        ...rest,
        tags: tags.map((t) => t.name),
        title: `${current.title} (copie)`,
        slug: uniqueSlug(
          current.typeId,
          `${current.slug}-copie`,
          undefined,
          current.lang,
        ),
        translationOf: null,
        status: "draft",
        publishedAt: null,
      },
      user.id,
    );
    return json({ content }, 201);
  }),
  remove: api(async ({ request, params }) => {
    await requireUser(request);
    if (getIdentity().homeId === params.id)
      throw new HttpError(
        409,
        "C'est la page d'accueil : choisissez-en une autre d'abord.",
      );
    deleteContent(params.id);
    return json({ ok: true });
  }),
};

const starterBlocks = (): Block[] => [
  {
    id: blockId(),
    type: "section",
    props: { width: "container", anchor: "" },
    children: [
      {
        id: blockId(),
        type: "heading",
        props: { text: "Nouvelle page", level: "1", align: "left" },
      },
    ],
  },
];

/* Types de contenu */
const typeInput = z.object({
  name: z.string().min(1).max(80),
  prefix: z
    .string()
    .max(40)
    .transform((v) => slugify(v)),
  editor: z.enum(["document", "builder"]),
  layoutId: z.string().nullable(),
  template: blocksOrEmpty,
  fields: z
    .array(z.unknown())
    .default([])
    .transform((v) => cleanFieldDefs(v)),
  hasBody: z.boolean().default(true),
});

const RESERVED = new Set([
  "admin",
  "api",
  "media",
  "_build",
  "_server",
  "favicon.png",
  "sitemap.xml",
  "robots.txt",
  "healthz",
  "fonts",
  TAG_PREFIX,
]);

/* Tags */
export const tags = {
  list: api(async ({ request }) => {
    await requireUser(request);
    return json({ items: listTags() });
  }),
  update: api(async ({ request, params }) => {
    await requireUser(request);
    const input = await body(
      request,
      z.object({
        name: z.string().min(1).max(60).optional(),
        slug: z.string().max(80).optional(),
      }),
    );
    const tag = updateTag(params.id, input);
    if (!tag) throw new HttpError(404, "Tag introuvable.");
    return json({ tag });
  }),
  remove: api(async ({ request, params }) => {
    await requireUser(request);
    deleteTag(params.id);
    return json({ ok: true });
  }),
};

export const types = {
  list: api(async ({ request }) => {
    await requireUser(request);
    return json({ items: listTypes() });
  }),
  get: api(async ({ request, params }) => {
    await requireUser(request);
    const type = getType(params.id);
    if (!type) throw new HttpError(404, "Type introuvable.");
    const template =
      type.template.length || type.editor === "builder"
        ? type.template
        : DEFAULT_TEMPLATE();
    return json({
      type: {
        ...type,
        template:
          type.editor === "document"
            ? withFieldBlocks(template, type.fields)
            : template,
      },
    });
  }),
  create: api(async ({ request }) => {
    await requireUser(request, "admin");
    const input = await body(request, typeInput);
    if (RESERVED.has(input.prefix))
      throw new HttpError(409, "Préfixe réservé.");
    const typeId = uniqueTypeId(slugify(input.name) || "type");
    const template = input.template.length
      ? input.template
      : input.editor === "document"
        ? sanitizeBlocks(DEFAULT_TEMPLATE())
        : [];
    return json(
      { type: saveType(fromTemplate({ ...input, id: typeId, template })) },
      201,
    );
  }),
  update: api(async ({ request, params }) => {
    await requireUser(request, "admin");
    const current = getType(params.id);
    if (!current) throw new HttpError(404, "Type introuvable.");
    const input = await body(request, typeInput.partial());
    const next = { ...current, ...input };
    if (current.builtin && current.id === "page") next.prefix = "";
    if (next.prefix && RESERVED.has(next.prefix))
      throw new HttpError(409, "Préfixe réservé.");
    return json({ type: saveType(input.template ? fromTemplate(next) : next) });
  }),
  remove: api(async ({ request, params }) => {
    await requireUser(request, "admin");
    const count = listContents({ typeId: params.id, limit: 1 }).total;
    if (count > 0)
      throw new HttpError(409, "Ce type contient encore des contenus.");
    if (!deleteType(params.id))
      throw new HttpError(409, "Type intégré : suppression impossible.");
    return json({ ok: true });
  }),
};

/** Pour un type « champs + modèle », les champs viennent des blocs-champs posés dans le modèle. */
function fromTemplate<
  T extends {
    editor: string;
    template: Block[];
    fields?: ContentField[];
    hasBody?: boolean;
  },
>(type: T): T {
  if (type.editor !== "document") return type;
  const derived = deriveFields(type.template);
  return {
    ...type,
    template: derived.template,
    fields: derived.fields,
    hasBody: derived.hasBody,
  };
}

function uniqueTypeId(base: string) {
  let candidate = base;
  for (let i = 2; getType(candidate); i++) candidate = `${base}-${i}`;
  return candidate;
}

/* Layouts */
const layoutInput = z.object({
  name: z.string().min(1).max(80),
  header: blocksOrEmpty,
  footer: blocksOrEmpty,
  options: z
    .object({
      stickyHeader: z.boolean().optional(),
      headerBackground: z.string().max(40).optional(),
      footerBackground: z.string().max(40).optional(),
    })
    .default({}),
  isDefault: z.boolean().optional(),
});

export const layouts = {
  list: api(async ({ request }) => {
    await requireUser(request);
    return json({ items: listLayouts() });
  }),
  get: api(async ({ request, params }) => {
    await requireUser(request);
    const layout = getLayout(params.id);
    if (!layout) throw new HttpError(404, "Layout introuvable.");
    return json({ layout });
  }),
  create: api(async ({ request }) => {
    await requireUser(request, "admin");
    const input = await body(request, layoutInput);
    return json({ layout: saveLayout(input) }, 201);
  }),
  update: api(async ({ request, params }) => {
    await requireUser(request, "admin");
    const current = getLayout(params.id);
    if (!current) throw new HttpError(404, "Layout introuvable.");
    const input = await body(request, layoutInput.partial());
    return json({ layout: saveLayout({ ...current, ...input }, current.id) });
  }),
  remove: api(async ({ request, params }) => {
    await requireUser(request, "admin");
    if (!deleteLayout(params.id))
      throw new HttpError(
        409,
        "Le layout par défaut ne peut pas être supprimé.",
      );
    return json({ ok: true });
  }),
};

/* Menus */
const menuItem: z.ZodType<MenuItem> = z.lazy(() =>
  z.object({
    id: z.string().max(64),
    label: z.string().max(120),
    url: z.string().max(500).optional(),
    contentId: z.string().max(64).optional(),
    children: z.array(menuItem).max(50).optional(),
  }),
);
const menuInput = z.object({
  name: z.string().min(1).max(80),
  items: z.array(menuItem).max(100),
});

export const menus = {
  list: api(async ({ request }) => {
    await requireUser(request);
    return json({ items: listMenus() });
  }),
  create: api(async ({ request }) => {
    await requireUser(request, "admin");
    const input = await body(request, menuInput);
    let menuId = slugify(input.name) || "menu";
    for (let i = 2; getMenu(menuId); i++)
      menuId = `${slugify(input.name)}-${i}`;
    return json({ menu: saveMenu({ id: menuId, ...input }) }, 201);
  }),
  update: api(async ({ request, params }) => {
    await requireUser(request, "admin");
    if (!getMenu(params.id)) throw new HttpError(404, "Menu introuvable.");
    const input = await body(request, menuInput);
    return json({ menu: saveMenu({ id: params.id, ...input }) });
  }),
  remove: api(async ({ request, params }) => {
    await requireUser(request, "admin");
    deleteMenu(params.id);
    return json({ ok: true });
  }),
};

/* Extensions */
const pluginsInput = z.object({
  i18n: z.object({
    enabled: z.boolean(),
    languages: z
      .array(
        z.object({
          code: z.string().regex(/^[a-z]{2,3}$/),
          label: z.string().max(40).default(""),
        }),
      )
      .max(20),
  }),
});

export const plugins = {
  get: api(async ({ request }) => {
    await requireUser(request);
    return json({ plugins: getPlugins(), mainLang: getIdentity().lang });
  }),
  update: api(async ({ request }) => {
    await requireUser(request, "admin");
    const input = await body(request, pluginsInput);
    const main = getIdentity().lang.split("-")[0];
    const seen = new Set<string>();
    const languages = [];
    for (const l of input.i18n.languages) {
      if (l.code === main || seen.has(l.code)) continue;
      // Le code devient un préfixe d'adresse : il ne doit rien masquer.
      if (RESERVED.has(l.code) || typeByPrefix(l.code))
        throw new HttpError(409, `« ${l.code} » est déjà une adresse du site.`);
      seen.add(l.code);
      languages.push({
        code: l.code,
        label: l.label.trim() || LANGUAGE_NAMES[l.code] || l.code.toUpperCase(),
      });
    }
    return json({
      plugins: savePlugins({
        i18n: { enabled: input.i18n.enabled, languages },
      }),
    });
  }),
};

/* Identité */
const colorValue = z.string().regex(/^#[0-9a-f]{3,8}$/i);
const identityInput = z.object({
  name: z.string().min(1).max(120),
  tagline: z.string().max(200),
  lang: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
  logoId: z.string().max(64),
  faviconId: z.string().max(64),
  ogImageId: z.string().max(64),
  description: z.string().max(400),
  titleTemplate: z.string().max(120),
  homeId: z.string().max(64),
  colors: z.object({
    primary: colorValue,
    secondary: colorValue,
    text: colorValue,
    background: colorValue,
    surface: colorValue,
    muted: colorValue,
  }),
  fonts: z.object({ heading: z.string().max(40), body: z.string().max(40) }),
  radius: z.number().min(0).max(48),
  width: z.number().min(640).max(2400),
});

export const identity = {
  get: api(async ({ request }) => {
    await requireUser(request);
    return json({ identity: getIdentity() });
  }),
  update: api(async ({ request }) => {
    await requireUser(request, "admin");
    const input = await body(request, identityInput);
    if (input.homeId) {
      const home = getContent(input.homeId);
      if (!home) throw new HttpError(404, "Page d'accueil introuvable.");
    }
    return json({ identity: saveIdentity(input) });
  }),
};

/* Médias */
export const media = {
  list: api(async ({ request }) => {
    await requireUser(request);
    const q = query(request);
    return json(
      listMedia({
        q: q.get("q") || undefined,
        kind: (q.get("kind") as "image" | "file") || undefined,
        limit: Math.min(200, Number(q.get("limit")) || 60),
        offset: Number(q.get("offset")) || 0,
      }),
    );
  }),
  get: api(async ({ request, params }) => {
    await requireUser(request);
    const item = getMedia(params.id);
    if (!item) throw new HttpError(404, "Média introuvable.");
    return json({ item });
  }),
  upload: api(async ({ request }) => {
    await requireUser(request);
    const form = await request.formData();
    const files = form
      .getAll("file")
      .filter((f): f is File => typeof f === "object" && "arrayBuffer" in f);
    if (!files.length) throw new HttpError(400, "Aucun fichier.");
    const items = [];
    try {
      for (const file of files)
        items.push(
          await storeUpload({
            name: file.name,
            type: file.type,
            bytes: new Uint8Array(await file.arrayBuffer()),
          }),
        );
    } catch (error) {
      if (error instanceof MediaError) throw new HttpError(422, error.message);
      throw error;
    }
    return json({ items }, 201);
  }),
  update: api(async ({ request, params }) => {
    await requireUser(request);
    const input = await body(
      request,
      z.object({
        alt: z.string().max(300).optional(),
        name: z.string().min(1).max(200).optional(),
      }),
    );
    const item = updateMedia(params.id, input);
    if (!item) throw new HttpError(404, "Média introuvable.");
    return json({ item });
  }),
  remove: api(async ({ request, params }) => {
    await requireUser(request);
    if (!(await removeMedia(params.id)))
      throw new HttpError(404, "Média introuvable.");
    return json({ ok: true });
  }),
};

/* Aperçu d'un lien collé dans l'éditeur */
export const linkPreview = api(async ({ request }) => {
  await requireUser(request);
  const url = query(request).get("url") ?? "";
  try {
    return json({ preview: await unfurl(url) });
  } catch (error) {
    if (error instanceof UnfurlError) throw new HttpError(422, error.message);
    throw error;
  }
});

/* Aperçu de l'éditeur */
const previewInput = z.object({
  kind: z.enum(["content", "layout", "template"]),
  blocks: blocksOrEmpty,
  header: blocks.optional(),
  footer: blocks.optional(),
  options: z.record(z.any()).optional(),
  contentId: z.string().optional(),
  typeId: z.string().optional(),
  layoutId: z.string().nullable().optional(),
  title: z.string().optional(),
  fields: z.array(z.unknown()).optional(),
});

const SAMPLE_BODY =
  '<p>Un paragraphe d\'exemple pour visualiser la mise en forme du corps du contenu.</p><h2>Intertitre</h2><p>Un second paragraphe, avec un <a href="#">lien</a>.</p>';

export const preview = api(async ({ request }) => {
  await requireUser(request);
  const input = await body(request, previewInput);
  const identityValue = getIdentity();
  const content = input.contentId ? getContent(input.contentId) : undefined;
  const ctx = renderContext(identityValue, {
    editor: true,
    lang: content?.lang,
  });
  // Aperçu du sélecteur de langue avec les langues actives.
  ctx.languages = siteLanguages(identityValue).map((l, i) => ({
    code: l.code || l.tag.split("-")[0],
    tag: l.tag,
    label: l.label,
    url: "#",
    current: l.code === (content?.lang ?? "") || (!content && i === 0),
  }));
  const type = getType(input.typeId ?? content?.typeId ?? "page");
  const fields = input.fields
    ? cleanFieldDefs(input.fields)
    : (type?.fields ?? []);
  ctx.content = {
    title: input.title ?? content?.title ?? "Titre d'exemple",
    bodyHtml: content?.body || SAMPLE_BODY,
    coverId: content?.coverId ?? null,
    publishedAt: content?.publishedAt ?? Date.now(),
    authorName: content?.authorName ?? "Auteur",
    fields,
    data: content?.data ?? {},
    tags: content?.tags.length
      ? content.tags
      : [{ id: "x", name: "Exemple", slug: "exemple" }],
  };
  let layout = layoutFor(type);
  if (input.layoutId !== undefined)
    layout = input.layoutId ? getLayout(input.layoutId) : layout;
  let main = input.blocks;
  if (input.kind === "layout") {
    const base = layout ?? {
      id: "preview",
      name: "",
      header: [],
      footer: [],
      options: {},
      isDefault: false,
    };
    layout = {
      ...base,
      header: input.header ?? base.header,
      footer: input.footer ?? base.footer,
      options: { ...base.options, ...input.options },
    };
    main = [
      {
        id: "preview-main",
        type: "section",
        props: { width: "container" },
        children: [
          {
            id: "preview-ph",
            type: "heading",
            props: { text: "Contenu de la page", level: "2", align: "center" },
          },
        ],
        style: {
          desktop: {
            padding: { top: 120, bottom: 120 },
            background: "var(--ws-surface)",
          },
        },
      },
    ];
  }
  const html = renderDocument({
    ctx,
    layout,
    main,
    title: ctx.content.title,
    noindex: true,
    editable: input.kind === "layout" ? "layout" : "main",
  });
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
});

/** Aperçu d'un brouillon tel qu'il sera publié. */
export const draft = api(async ({ request, params }) => {
  await requireUser(request);
  const content = getContent(params.id);
  if (!content) throw new HttpError(404, "Contenu introuvable.");
  const html = renderContent(content) ?? "";
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
});

/* Export / import */
export const exportZip = api(async ({ request }) => {
  await requireUser(request, "admin");
  const zip = await exportSite();
  const date = new Date().toISOString().slice(0, 10);
  return new Response(zip, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${slugify(getIdentity().name) || "site"}-${date}.zip"`,
      "cache-control": "no-store",
    },
  });
});

export const importZip = api(async ({ request }) => {
  await requireUser(request, "admin");
  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file !== "object")
    throw new HttpError(400, "Aucun fichier.");
  try {
    const result = await importSite(
      new Uint8Array(await (file as File).arrayBuffer()),
    );
    return json({ ...result, ok: true }, 200, {
      "set-cookie": clearSessionCookie(request),
    });
  } catch (error) {
    if (error instanceof ImportError) throw new HttpError(422, error.message);
    throw error;
  }
});
