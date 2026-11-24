import { useBeforeLeave, useNavigate, useParams } from "@solidjs/router";
import {
  createResource,
  createSignal,
  type JSX,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
} from "solid-js";
import { Builder } from "../builder/builder.view";
import { NotionEditor } from "../editor/notion-editor.view";
import { slugify } from "../render/html";
import type {
  Content,
  ContentType,
  Identity,
  Language,
  Tag,
  Translation,
} from "../site/site.type";
import { Button, LinkButton } from "../ui/button.view";
import { confirmDialog } from "../ui/dialog.view";
import { TextArea } from "../ui/field.view";
import { Badge, Notice, Panel } from "../ui/layout.view";
import { api } from "./client";
import { FieldsForm, Permalink, TagInput } from "./content-fields.view";
import { fetchMedia, MediaField, Thumb } from "./media-library.view";
import { fetchPlugins } from "./plugins.view";
import { notify, notifyError } from "./toast";

type Draft = Content & { tagNames: string[] };
type Loaded = {
  content: Draft;
  url: string;
  type: ContentType;
  tags: string[];
  homeId: string;
  translations: Translation[];
  /** Langues du site (la principale a un code vide), si l'extension est active. */
  languages: Language[];
};

/** Versions linguistiques : ouvrir une traduction ou la créer. */
function LangBar(props: {
  content: Draft;
  languages: Language[];
  translations: Translation[];
}) {
  const navigate = useNavigate();
  const create = async (lang: string) => {
    try {
      const { content } = await api<{ content: Content }>(
        `/api/contents/${props.content.id}/translate`,
        { body: { lang } },
      );
      navigate(`/admin/contents/${content.id}`);
    } catch (e) {
      notifyError(e);
    }
  };
  return (
    <nav class="ui-langbar" aria-label="Langues">
      {props.languages.map((l) => {
        const version = props.translations.find((t) => t.lang === l.code);
        const code = l.label;
        if (l.code === props.content.lang)
          return (
            <span class="ui-langbar__item" aria-current="true">
              {code}
            </span>
          );
        return version ? (
          <a
            class="ui-langbar__item"
            href={`/admin/contents/${version.id}`}
            title={version.title}
            classList={{
              "ui-langbar__item--draft": version.status !== "published",
            }}
          >
            {code}
          </a>
        ) : (
          <button
            type="button"
            class="ui-langbar__item ui-langbar__item--missing"
            aria-label={`Traduire en ${code}`}
            title={`Traduire en ${code}`}
            onClick={() => create(l.code)}
          >
            + {code}
          </button>
        );
      })}
    </nav>
  );
}

function Settings(props: {
  content: Draft;
  url: string;
  type: ContentType;
  suggestions: string[];
  withPermalink?: boolean;
  withFields?: boolean;
  isHome?: boolean;
  onChange: (patch: Partial<Draft>) => void;
}) {
  return (
    <>
      <Show when={props.withPermalink}>
        <div class="ui-field">
          <span class="ui-field__label">Adresse</span>
          <Permalink
            prefix={props.type.prefix}
            slug={props.content.slug}
            title={props.content.title}
            isHome={props.isHome}
            onChange={(slug) => props.onChange({ slug })}
          />
        </div>
      </Show>
      <TagInput
        value={props.content.tagNames}
        suggestions={props.suggestions}
        onChange={(tagNames) => props.onChange({ tagNames })}
      />
      <Show when={props.withFields && props.type.fields.length}>
        <FieldsForm
          fields={props.type.fields}
          data={props.content.data}
          onChange={(data) => props.onChange({ data })}
        />
      </Show>
      <TextArea
        label="Description"
        rows={3}
        value={props.content.excerpt}
        maxlength={500}
        hint={`${props.content.excerpt.length}/160`}
        onInput={(e) => props.onChange({ excerpt: e.currentTarget.value })}
      />
      <MediaField
        label="Couverture"
        value={props.content.coverId ?? ""}
        onChange={(id) => props.onChange({ coverId: id || null })}
      />
    </>
  );
}

export function ContentEditorView() {
  const params = useParams();
  const [data, { mutate }] = createResource(
    () => params.id,
    async (id) => {
      const [
        { content, url, translations },
        { items },
        tags,
        identity,
        plugins,
      ] = await Promise.all([
        api<{ content: Content; url: string; translations: Translation[] }>(
          `/api/contents/${id}`,
        ),
        api<{ items: ContentType[] }>("/api/types"),
        api<{ items: Tag[] }>("/api/tags"),
        api<{ identity: Identity }>("/api/identity"),
        fetchPlugins(),
      ]);
      const { i18n } = plugins.plugins;
      const main = identity.identity.lang.split("-")[0].toUpperCase();
      const languages: Language[] = i18n.enabled
        ? [
            { code: "", label: main },
            ...i18n.languages.map((l) => ({
              code: l.code,
              label: l.code.toUpperCase(),
            })),
          ]
        : [];
      const type = items.find((t) => t.id === content.typeId) as ContentType;
      return {
        content: { ...content, tagNames: content.tags.map((t) => t.name) },
        url,
        type,
        tags: tags.items.map((t) => t.name),
        homeId: identity.identity.homeId,
        translations,
        languages,
      } as Loaded;
    },
  );
  const [dirty, setDirty] = createSignal(false);
  const [saving, setSaving] = createSignal(false);

  const change = (patch: Partial<Draft>) => {
    const current = data();
    if (!current) return;
    const c = current.content;
    // Tant que le contenu n'a jamais été publié, l'adresse suit le titre.
    const follow =
      patch.title !== undefined &&
      !c.publishedAt &&
      c.slug === slugify(c.title);
    const next = {
      ...c,
      ...patch,
      ...(follow ? { slug: slugify(patch.title as string) || c.slug } : {}),
    };
    mutate({ ...current, content: next });
    setDirty(true);
  };

  const save = async (extra: Partial<Draft> = {}) => {
    const current = data();
    if (!current || saving()) return;
    setSaving(true);
    const c = { ...current.content, ...extra };
    try {
      const res = await api<{ content: Content; url: string }>(
        `/api/contents/${c.id}`,
        {
          method: "PATCH",
          body: {
            title: c.title,
            slug: c.slug,
            status: c.status,
            excerpt: c.excerpt,
            body: c.body,
            blocks: c.blocks,
            coverId: c.coverId,
            data: c.data,
            tags: c.tagNames,
          },
        },
      );
      // Les blocs restent ceux de l'éditeur pour ne pas perdre la sélection.
      mutate({
        ...current,
        url: res.url,
        content: {
          ...res.content,
          blocks: c.blocks,
          body: c.body,
          tagNames: res.content.tags.map((t) => t.name),
        },
        tags: [
          ...new Set([...current.tags, ...res.content.tags.map((t) => t.name)]),
        ],
      });
      setDirty(false);
      notify(
        extra.status === "published"
          ? "Publié"
          : extra.status === "draft"
            ? "Repassé en brouillon"
            : "Enregistré",
      );
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  };

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (dirty()) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    onCleanup(() => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onUnload);
    });
  });

  useBeforeLeave((e) => {
    if (!dirty() || e.defaultPrevented) return;
    e.preventDefault();
    confirmDialog({
      title: "Quitter sans enregistrer ?",
      confirmLabel: "Quitter",
      danger: true,
    }).then((ok) => {
      if (!ok) return;
      setDirty(false);
      e.retry(true);
    });
  });

  const actions = (d: Loaded): JSX.Element => (
    <>
      <Show when={d.languages.length > 1}>
        <LangBar
          content={d.content}
          languages={d.languages}
          translations={d.translations}
        />
      </Show>
      <Show when={dirty()}>
        <span
          class="ui-dirty"
          role="img"
          aria-label="Modifications non enregistrées"
          title="Modifications non enregistrées"
        />
      </Show>
      <Badge tone={d.content.status === "published" ? "success" : "neutral"}>
        {d.content.status === "published" ? "Publié" : "Brouillon"}
      </Badge>
      <LinkButton
        variant="quiet"
        icon="eye"
        href={
          d.content.status === "published" && !dirty()
            ? d.url
            : `/api/contents/${d.content.id}/draft`
        }
        target="_blank"
        rel="noopener"
        aria-label="Voir"
      />
      <Button
        variant="ghost"
        icon="save"
        disabled={saving()}
        onClick={() => save()}
        label="Enregistrer"
      >
        <span class="ui-btn__text">Enregistrer</span>
      </Button>
      <Show
        when={d.content.status === "published"}
        fallback={
          <Button
            variant="solid"
            disabled={saving()}
            onClick={() => save({ status: "published" })}
          >
            Publier
          </Button>
        }
      >
        <Button
          variant="quiet"
          disabled={saving()}
          onClick={() => save({ status: "draft" })}
        >
          Dépublier
        </Button>
      </Show>
    </>
  );

  return (
    <Show
      when={data()}
      fallback={
        <Show when={data.error}>
          <Notice tone="danger">Contenu introuvable.</Notice>
        </Show>
      }
    >
      {(d) => (
        <Switch>
          <Match when={d().type.editor === "builder"}>
            <Builder
              scope="content"
              zones={[{ key: "main", label: "Page" }]}
              value={{ main: d().content.blocks }}
              onChange={(v) => change({ blocks: v.main })}
              preview={(v) => ({
                kind: "content",
                typeId: d().type.id,
                contentId: d().content.id,
                title: d().content.title,
                blocks: v.main,
              })}
              bar={
                <>
                  <LinkButton
                    variant="quiet"
                    icon="back"
                    href="/admin"
                    aria-label="Contenus"
                  />
                  <input
                    class="ui-input ui-input--title"
                    aria-label="Titre"
                    value={d().content.title}
                    onInput={(e) => change({ title: e.currentTarget.value })}
                  />
                </>
              }
              actions={actions(d())}
              settingsTitle={d().type.name}
              settings={
                <Settings
                  content={d().content}
                  url={d().url}
                  type={d().type}
                  suggestions={d().tags}
                  isHome={d().homeId === d().content.id}
                  withPermalink
                  withFields
                  onChange={change}
                />
              }
            />
          </Match>
          <Match when={d().type.editor === "document"}>
            <header class="ui-page-head">
              <div class="ui-toolbar">
                <LinkButton variant="quiet" icon="back" href="/admin">
                  Contenus
                </LinkButton>
                <span class="ui-muted">{d().type.name}</span>
              </div>
              <div class="ui-toolbar">{actions(d())}</div>
            </header>
            <div class="ui-doc">
              <article class="ui-doc__paper">
                <Show when={d().content.coverId}>
                  {(id) => (
                    <div class="ui-doc__cover">
                      <CoverImage id={id()} />
                    </div>
                  )}
                </Show>
                <div class="ui-doc__title">
                  <textarea
                    class="ui-input ui-input--title"
                    aria-label="Titre"
                    rows={1}
                    placeholder="Sans titre"
                    value={d().content.title}
                    style={{ resize: "none", "field-sizing": "content" }}
                    onInput={(e) => change({ title: e.currentTarget.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        (
                          document.querySelector(
                            ".ui-doc .ProseMirror",
                          ) as HTMLElement | null
                        )?.focus();
                      }
                    }}
                  />
                </div>
                <Permalink
                  prefix={d().type.prefix}
                  slug={d().content.slug}
                  title={d().content.title}
                  isHome={d().homeId === d().content.id}
                  onChange={(slug) => change({ slug })}
                />
                <Show when={d().type.fields.length}>
                  <div class="ui-doc__fields">
                    <FieldsForm
                      fields={d().type.fields}
                      data={d().content.data}
                      onChange={(value) => change({ data: value })}
                    />
                  </div>
                </Show>
                <Show when={d().type.hasBody}>
                  <NotionEditor
                    label="Corps"
                    value={d().content.body}
                    onChange={(html) => change({ body: html })}
                  />
                </Show>
              </article>
              <aside class="ui-doc__side">
                <Panel title="Réglages">
                  <Settings
                    content={d().content}
                    url={d().url}
                    type={d().type}
                    suggestions={d().tags}
                    onChange={change}
                  />
                </Panel>
              </aside>
            </div>
          </Match>
        </Switch>
      )}
    </Show>
  );
}

function CoverImage(props: { id: string }) {
  const [media] = createResource(() => props.id, fetchMedia);
  return <Thumb media={media()} />;
}
