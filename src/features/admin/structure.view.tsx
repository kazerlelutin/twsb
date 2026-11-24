import { useNavigate, useParams } from "@solidjs/router";
import { createResource, createSignal, For, Show } from "solid-js";
import type { Block } from "../blocks/block.type";
import { isFieldBlock } from "../blocks/catalog";
import { walk } from "../blocks/tree.service";
import { Builder } from "../builder/builder.view";
import type { ContentType, Layout } from "../site/site.type";
import { Button, LinkButton } from "../ui/button.view";
import { confirmDialog, promptDialog } from "../ui/dialog.view";
import { ColorField, SelectField, TextField, Toggle } from "../ui/field.view";
import { Badge, Empty, Notice, PageHead, Panel } from "../ui/layout.view";
import { Modal } from "../ui/modal.view";
import { api } from "./client";
import { notify, notifyError } from "./toast";

const EDITORS = [
  { value: "document", label: "Champs + modèle commun" },
  { value: "builder", label: "Page libre en blocs" },
];

/* Types de contenu */

export function TypesView() {
  const navigate = useNavigate();
  const [types, { refetch }] = createResource(() =>
    api<{ items: ContentType[] }>("/api/types").then((r) => r.items),
  );
  const [layouts] = createResource(() =>
    api<{ items: Layout[] }>("/api/layouts").then((r) => r.items),
  );
  const [open, setOpen] = createSignal(false);
  const [error, setError] = createSignal("");
  const layoutName = (id: string | null) =>
    layouts()?.find((l) => l.id === id)?.name ?? "Par défaut";

  const create = async (e: SubmitEvent) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget as HTMLFormElement);
    try {
      const { type } = await api<{ type: ContentType }>("/api/types", {
        body: {
          name: form.get("name"),
          prefix: form.get("prefix"),
          editor: form.get("editor"),
          layoutId: form.get("layoutId") || null,
        },
      });
      setOpen(false);
      navigate(`/admin/types/${type.id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const remove = async (type: ContentType) => {
    if (
      !(await confirmDialog({
        title: `Supprimer le type « ${type.name} » ?`,
        danger: true,
      }))
    )
      return;
    try {
      await api(`/api/types/${type.id}`, { method: "DELETE" });
      refetch();
    } catch (err) {
      notifyError(err);
    }
  };

  return (
    <>
      <PageHead
        title="Types de contenu"
        actions={
          <Button variant="solid" icon="plus" onClick={() => setOpen(true)}>
            Nouveau
          </Button>
        }
      />
      <div class="ui-grid">
        <For each={types()}>
          {(type) => (
            <article class="ui-card">
              <h2>
                <a class="ui-table__link" href={`/admin/types/${type.id}`}>
                  {type.name}
                </a>
              </h2>
              <p>{type.prefix ? `/${type.prefix}/…` : "/…"}</p>
              <div class="ui-card__foot">
                <Badge tone="accent">
                  {type.editor === "builder" ? "Blocs" : "Document"}
                </Badge>
                <Badge>{layoutName(type.layoutId)}</Badge>
                <Show when={!type.builtin}>
                  <Button
                    variant="quiet"
                    size="sm"
                    icon="trash"
                    iconOnly
                    label={`Supprimer ${type.name}`}
                    style={{ "margin-left": "auto" }}
                    onClick={() => remove(type)}
                  />
                </Show>
              </div>
            </article>
          )}
        </For>
      </div>
      <Modal
        open={open()}
        title="Nouveau type"
        onClose={() => setOpen(false)}
        footer={
          <Button variant="solid" type="submit" form="new-type">
            Créer
          </Button>
        }
      >
        <form id="new-type" onSubmit={create}>
          <TextField label="Nom" name="name" required placeholder="Projets" />
          <TextField
            label="Préfixe d'URL"
            name="prefix"
            placeholder="projets"
          />
          <SelectField
            label="Édition"
            name="editor"
            options={EDITORS}
            value="document"
          />
          <SelectField
            label="Layout"
            name="layoutId"
            empty="Par défaut"
            options={(layouts() ?? []).map((l) => ({
              value: l.id,
              label: l.name,
            }))}
          />
          <Show when={error()}>
            <Notice tone="danger">{error()}</Notice>
          </Show>
        </form>
      </Modal>
    </>
  );
}

function useType() {
  const params = useParams();
  const [type, { mutate }] = createResource(
    () => params.id,
    (id) => api<{ type: ContentType }>(`/api/types/${id}`).then((r) => r.type),
  );
  const [dirty, setDirty] = createSignal(false);
  const change = (patch: Partial<ContentType>) => {
    const t = type();
    if (!t) return;
    mutate({ ...t, ...patch });
    setDirty(true);
  };
  const save = async () => {
    const t = type();
    if (!t) return;
    try {
      const res = await api<{ type: ContentType }>(`/api/types/${t.id}`, {
        method: "PATCH",
        body: {
          name: t.name,
          prefix: t.prefix,
          editor: t.editor,
          layoutId: t.layoutId,
          template: t.template,
          fields: t.fields,
          hasBody: t.hasBody,
        },
      });
      mutate({ ...res.type, template: t.template });
      setDirty(false);
      notify("Type enregistré");
    } catch (e) {
      notifyError(e);
    }
  };
  return { type, change, save, dirty };
}

/** Champs posés dans le modèle, dans l'ordre : c'est le formulaire des contenus. */
const templateFields = (blocks: Block[]) => {
  const out: string[] = [];
  walk(blocks, (b) => {
    if (isFieldBlock(b.type)) out.push(String(b.props?.label || "Champ"));
  });
  return out;
};

function TypeSettings(props: {
  type: ContentType;
  layouts: Layout[];
  onChange: (patch: Partial<ContentType>) => void;
}) {
  return (
    <>
      <TextField
        label="Préfixe d'URL"
        value={props.type.prefix}
        disabled={props.type.id === "page"}
        onChange={(e) => props.onChange({ prefix: e.currentTarget.value })}
      />
      <SelectField
        label="Édition"
        options={EDITORS}
        value={props.type.editor}
        onChange={(e) =>
          props.onChange({
            editor: e.currentTarget.value as ContentType["editor"],
          })
        }
      />
      <SelectField
        label="Layout"
        empty="Par défaut"
        value={props.type.layoutId ?? ""}
        options={props.layouts.map((l) => ({ value: l.id, label: l.name }))}
        onChange={(e) =>
          props.onChange({ layoutId: e.currentTarget.value || null })
        }
      />
    </>
  );
}

/**
 * Un type « champs + modèle » se construit dans l'éditeur visuel :
 * on y dépose des champs nommés, que chaque contenu remplit ensuite.
 */
export function TypeEditorView() {
  const { type, change, save, dirty } = useType();
  const [layouts] = createResource(() =>
    api<{ items: Layout[] }>("/api/layouts").then((r) => r.items),
  );
  const saveButton = () => (
    <>
      <Show when={dirty()}>
        <span
          class="ui-dirty"
          role="img"
          aria-label="Modifications non enregistrées"
        />
      </Show>
      <Button variant="solid" icon="save" onClick={save}>
        <span class="ui-btn__text">Enregistrer</span>
      </Button>
    </>
  );
  return (
    <Show when={type()}>
      {(t) => (
        <Show
          when={t().editor === "document"}
          fallback={
            <>
              <PageHead
                eyebrow="Type de contenu"
                title={t().name}
                actions={
                  <>
                    <LinkButton variant="quiet" icon="back" href="/admin/types">
                      Types
                    </LinkButton>
                    {saveButton()}
                  </>
                }
              />
              <Panel title="Réglages">
                <TextField
                  label="Nom"
                  value={t().name}
                  onInput={(e) => change({ name: e.currentTarget.value })}
                />
                <TypeSettings
                  type={t()}
                  layouts={layouts() ?? []}
                  onChange={change}
                />
              </Panel>
            </>
          }
        >
          <Builder
            scope="template"
            zones={[{ key: "main", label: "Modèle" }]}
            value={{ main: t().template }}
            contentFields={t().fields}
            onChange={(v) => change({ template: v.main })}
            preview={(v) => ({
              kind: "template",
              typeId: t().id,
              layoutId: t().layoutId,
              blocks: v.main,
            })}
            bar={
              <>
                <LinkButton
                  variant="quiet"
                  icon="back"
                  href="/admin/types"
                  aria-label="Types"
                />
                <input
                  class="ui-input ui-input--title"
                  aria-label="Nom du type"
                  value={t().name}
                  onInput={(e) => change({ name: e.currentTarget.value })}
                />
              </>
            }
            actions={saveButton()}
            settingsTitle="Type"
            settings={
              <>
                <TypeSettings
                  type={t()}
                  layouts={layouts() ?? []}
                  onChange={change}
                />
                <div class="ui-field">
                  <span class="ui-field__label">Formulaire des contenus</span>
                  <Show
                    when={templateFields(t().template).length}
                    fallback={
                      <p class="ui-muted">
                        Titre{t().hasBody ? " | corps" : ""}
                      </p>
                    }
                  >
                    <ol class="ui-form-preview">
                      <li>Titre</li>
                      <For each={templateFields(t().template)}>
                        {(label) => <li>{label}</li>}
                      </For>
                    </ol>
                  </Show>
                </div>
              </>
            }
          />
        </Show>
      )}
    </Show>
  );
}

export function LayoutsView() {
  const navigate = useNavigate();
  const [layouts, { refetch }] = createResource(() =>
    api<{ items: Layout[] }>("/api/layouts").then((r) => r.items),
  );
  const create = async () => {
    const name = await promptDialog({
      title: "Nouveau layout",
      label: "Nom",
      confirmLabel: "Créer",
    });
    if (!name) return;
    const base = layouts()?.find((l) => l.isDefault);
    try {
      const { layout } = await api<{ layout: Layout }>("/api/layouts", {
        body: {
          name,
          header: base?.header ?? [],
          footer: base?.footer ?? [],
          options: base?.options ?? {},
        },
      });
      navigate(`/admin/layouts/${layout.id}`);
    } catch (e) {
      notifyError(e);
    }
  };
  const remove = async (layout: Layout) => {
    if (
      !(await confirmDialog({
        title: `Supprimer « ${layout.name} » ?`,
        danger: true,
      }))
    )
      return;
    await api(`/api/layouts/${layout.id}`, { method: "DELETE" }).catch(
      notifyError,
    );
    refetch();
  };
  return (
    <>
      <PageHead
        title="Layouts"
        actions={
          <Button variant="solid" icon="plus" onClick={create}>
            Nouveau
          </Button>
        }
      />
      <Show when={layouts()?.length} fallback={<Empty>Aucun layout</Empty>}>
        <div class="ui-grid">
          <For each={layouts()}>
            {(layout) => (
              <article class="ui-card">
                <h2>
                  <a
                    class="ui-table__link"
                    href={`/admin/layouts/${layout.id}`}
                  >
                    {layout.name}
                  </a>
                </h2>
                <p>
                  {layout.header.length} | {layout.footer.length}
                </p>
                <div class="ui-card__foot">
                  <Show when={layout.isDefault}>
                    <Badge tone="accent">Par défaut</Badge>
                  </Show>
                  <Show when={layout.options.stickyHeader}>
                    <Badge>En-tête fixe</Badge>
                  </Show>
                  <Show when={!layout.isDefault}>
                    <Button
                      variant="quiet"
                      size="sm"
                      icon="trash"
                      iconOnly
                      label={`Supprimer ${layout.name}`}
                      style={{ "margin-left": "auto" }}
                      onClick={() => remove(layout)}
                    />
                  </Show>
                </div>
              </article>
            )}
          </For>
        </div>
      </Show>
    </>
  );
}

export function LayoutEditorView() {
  const params = useParams();
  const [layout, { mutate }] = createResource(
    () => params.id,
    (id) => api<{ layout: Layout }>(`/api/layouts/${id}`).then((r) => r.layout),
  );
  const [dirty, setDirty] = createSignal(false);
  const change = (patch: Partial<Layout>) => {
    const l = layout();
    if (!l) return;
    mutate({ ...l, ...patch });
    setDirty(true);
  };
  const save = async () => {
    const l = layout();
    if (!l) return;
    try {
      await api(`/api/layouts/${l.id}`, {
        method: "PATCH",
        body: {
          name: l.name,
          header: l.header,
          footer: l.footer,
          options: l.options,
          isDefault: l.isDefault,
        },
      });
      setDirty(false);
      notify("Layout enregistré");
    } catch (e) {
      notifyError(e);
    }
  };
  return (
    <Show when={layout()}>
      {(l) => (
        <Builder
          scope="layout"
          zones={[
            { key: "header", label: "En-tête" },
            { key: "footer", label: "Pied" },
          ]}
          value={{ header: l().header, footer: l().footer }}
          onChange={(v) =>
            change({ header: v.header as Block[], footer: v.footer as Block[] })
          }
          preview={(v) => ({
            kind: "layout",
            layoutId: l().id,
            header: v.header,
            footer: v.footer,
            options: l().options,
          })}
          bar={
            <>
              <LinkButton
                variant="quiet"
                icon="back"
                href="/admin/layouts"
                aria-label="Layouts"
              />
              <input
                class="ui-input ui-input--title"
                aria-label="Nom du layout"
                value={l().name}
                onInput={(e) => change({ name: e.currentTarget.value })}
              />
            </>
          }
          actions={
            <>
              <Show when={dirty()}>
                <span
                  class="ui-dirty"
                  role="img"
                  aria-label="Modifications non enregistrées"
                />
              </Show>
              <Button variant="solid" icon="save" onClick={save}>
                <span class="ui-btn__text">Enregistrer</span>
              </Button>
            </>
          }
          settingsTitle="Layout"
          settings={
            <>
              <Toggle
                label="En-tête fixe"
                checked={!!l().options.stickyHeader}
                onChange={(v) =>
                  change({ options: { ...l().options, stickyHeader: v } })
                }
              />
              <Toggle
                label="Par défaut"
                checked={l().isDefault}
                disabled={l().isDefault}
                onChange={(v) => change({ isDefault: v })}
              />
              <ColorField
                label="Fond de l'en-tête"
                allowEmpty
                value={l().options.headerBackground ?? ""}
                onChange={(v) =>
                  change({
                    options: {
                      ...l().options,
                      headerBackground: v || undefined,
                    },
                  })
                }
              />
              <ColorField
                label="Fond du pied"
                allowEmpty
                value={l().options.footerBackground ?? ""}
                onChange={(v) =>
                  change({
                    options: {
                      ...l().options,
                      footerBackground: v || undefined,
                    },
                  })
                }
              />
            </>
          }
        />
      )}
    </Show>
  );
}
