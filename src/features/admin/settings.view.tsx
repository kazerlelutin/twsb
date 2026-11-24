import { createResource, createSignal, For, Show } from "solid-js";
import {
  type ContentSummary,
  FONT_STACKS,
  fontFaces,
  type Identity,
} from "../site/site.type";
import { Button, LinkButton } from "../ui/button.view";
import { confirmDialog } from "../ui/dialog.view";
import {
  ColorField,
  RangeField,
  SelectField,
  TextArea,
  TextField,
} from "../ui/field.view";
import { Badge, Notice, PageHead, Panel } from "../ui/layout.view";
import { Modal } from "../ui/modal.view";
import { Table } from "../ui/table.view";
import { api, formatDate, type User } from "./client";
import { MediaField } from "./media-library.view";
import { session } from "./session";
import { notify, notifyError } from "./toast";

/* Identité du site */

const COLORS: { key: keyof Identity["colors"]; label: string }[] = [
  { key: "primary", label: "Principale" },
  { key: "secondary", label: "Secondaire" },
  { key: "text", label: "Texte" },
  { key: "background", label: "Fond" },
  { key: "surface", label: "Surface" },
  { key: "muted", label: "Atténuée" },
];

const FONT_LIST = Object.entries(FONT_STACKS);

/** Choix d'une police : chaque option s'affiche dans sa propre police. */
function FontPicker(props: {
  label: string;
  value: string;
  sample: string;
  onChange: (key: string) => void;
}) {
  const name = `font-${props.label}`;
  return (
    <fieldset class="ui-fonts">
      <legend class="ui-field__label">{props.label}</legend>
      <div class="ui-fonts__list">
        <For each={FONT_LIST}>
          {([key, f]) => (
            <label
              class="ui-font"
              classList={{ "ui-font--on": props.value === key }}
            >
              <input
                type="radio"
                class="ui-sr"
                name={name}
                value={key}
                checked={props.value === key}
                onChange={() => props.onChange(key)}
              />
              <span class="ui-font__sample" style={{ "font-family": f.stack }}>
                {props.sample}
              </span>
              <span class="ui-font__name">{f.label}</span>
            </label>
          )}
        </For>
      </div>
    </fieldset>
  );
}

/** Aperçu de l'identité : polices, couleurs et arrondi appliqués. */
function IdentityPreview(props: { identity: Identity }) {
  const font = (key: string) =>
    FONT_STACKS[key]?.stack ?? FONT_STACKS.system.stack;
  return (
    <div
      class="ui-id-preview"
      aria-label="Aperçu"
      role="img"
      style={{
        background: props.identity.colors.background,
        color: props.identity.colors.text,
        "font-family": font(props.identity.fonts.body),
      }}
    >
      <p
        class="ui-id-preview__eyebrow"
        style={{ color: props.identity.colors.primary }}
      >
        {props.identity.tagline || props.identity.name}
      </p>
      <p
        class="ui-id-preview__title"
        style={{ "font-family": font(props.identity.fonts.heading) }}
      >
        Un titre qui donne le ton
      </p>
      <p class="ui-id-preview__text">
        Le texte courant de vos pages : accents é à ç, chiffres 0123, «
        guillemets ».
      </p>
      <div
        class="ui-id-preview__card"
        style={{
          background: props.identity.colors.surface,
          "border-radius": `${props.identity.radius}px`,
        }}
      >
        <span
          class="ui-id-preview__btn"
          style={{
            background: props.identity.colors.primary,
            "border-radius": `${props.identity.radius}px`,
          }}
        >
          Bouton
        </span>
        <span style={{ color: props.identity.colors.muted }}>
          Texte atténué
        </span>
      </div>
    </div>
  );
}

export function IdentityView() {
  const [identity, { mutate }] = createResource(() =>
    api<{ identity: Identity }>("/api/identity").then((r) => r.identity),
  );
  const [pages] = createResource(() =>
    api<{ items: ContentSummary[] }>(
      "/api/contents?type=page&status=published&limit=200",
    ).then((r) => r.items),
  );
  const change = (patch: Partial<Identity>) => {
    const current = identity();
    if (current) mutate({ ...current, ...patch });
  };
  const save = async () => {
    try {
      const res = await api<{ identity: Identity }>("/api/identity", {
        method: "PUT",
        body: identity(),
      });
      mutate(res.identity);
      notify("Identité enregistrée");
    } catch (e) {
      notifyError(e);
    }
  };
  return (
    <Show when={identity()}>
      {(id) => (
        <>
          <style>{fontFaces()}</style>
          <PageHead
            title="Identité"
            actions={
              <Button variant="solid" icon="save" onClick={save}>
                Enregistrer
              </Button>
            }
          />
          <div
            class="ui-grid"
            style={{
              "grid-template-columns":
                "repeat(auto-fill, minmax(min(100%, 22rem), 1fr))",
            }}
          >
            <Panel title="Site">
              <TextField
                label="Nom"
                value={id().name}
                onInput={(e) => change({ name: e.currentTarget.value })}
              />
              <TextField
                label="Slogan"
                value={id().tagline}
                onInput={(e) => change({ tagline: e.currentTarget.value })}
              />
              <SelectField
                label="Page d'accueil"
                value={id().homeId}
                options={(pages() ?? []).map((p) => ({
                  value: p.id,
                  label: p.title,
                }))}
                onChange={(e) => change({ homeId: e.currentTarget.value })}
              />
              <TextField
                label="Langue"
                value={id().lang}
                maxlength={5}
                onInput={(e) => change({ lang: e.currentTarget.value })}
              />
            </Panel>
            <Panel title="Images">
              <MediaField
                label="Logo"
                value={id().logoId}
                onChange={(v) => change({ logoId: v })}
              />
              <MediaField
                label="Favicon"
                value={id().faviconId}
                onChange={(v) => change({ faviconId: v })}
              />
              <MediaField
                label="Image de partage"
                value={id().ogImageId}
                onChange={(v) => change({ ogImageId: v })}
              />
            </Panel>
            <Panel title="Référencement">
              <TextField
                label="Modèle de titre"
                value={id().titleTemplate}
                hint="%s | %site"
                onInput={(e) =>
                  change({ titleTemplate: e.currentTarget.value })
                }
              />
              <TextArea
                label="Description"
                rows={4}
                maxlength={400}
                hint={`${id().description.length}/160`}
                value={id().description}
                onInput={(e) => change({ description: e.currentTarget.value })}
              />
            </Panel>
            <Panel
              title="Couleurs"
              action={
                <div class="ui-swatches" aria-hidden="true">
                  <For each={COLORS}>
                    {(c) => <span style={{ background: id().colors[c.key] }} />}
                  </For>
                </div>
              }
            >
              <div class="ui-form-grid">
                <For each={COLORS}>
                  {(c) => (
                    <ColorField
                      label={c.label}
                      value={id().colors[c.key]}
                      onChange={(v) =>
                        change({ colors: { ...id().colors, [c.key]: v } })
                      }
                    />
                  )}
                </For>
              </div>
            </Panel>
            <Panel title="Typographie et formes">
              <IdentityPreview identity={id()} />
              <FontPicker
                label="Titres"
                sample="Aa Titre"
                value={id().fonts.heading}
                onChange={(heading) =>
                  change({ fonts: { ...id().fonts, heading } })
                }
              />
              <FontPicker
                label="Texte"
                sample="Aa Texte"
                value={id().fonts.body}
                onChange={(body) => change({ fonts: { ...id().fonts, body } })}
              />
              <RangeField
                label="Arrondi"
                min={0}
                max={32}
                unit="px"
                hint={`${id().radius}px`}
                value={id().radius}
                onChange={(v) => change({ radius: v ?? 0 })}
              />
              <RangeField
                label="Largeur du contenu"
                min={640}
                max={1600}
                step={20}
                unit="px"
                hint={`${id().width}px`}
                value={id().width}
                onChange={(v) => change({ width: v ?? 1180 })}
              />
            </Panel>
          </div>
        </>
      )}
    </Show>
  );
}

/* Comptes */

export function UsersView() {
  const [users, { refetch }] = createResource(() =>
    api<{ items: User[] }>("/api/users").then((r) => r.items),
  );
  const [open, setOpen] = createSignal(false);
  const [link, setLink] = createSignal("");
  const [error, setError] = createSignal("");
  const me = () => session.user();

  const invite = async (e: SubmitEvent) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget as HTMLFormElement);
    setError("");
    try {
      const res = await api<{ sent: boolean; link?: string }>("/api/users", {
        body: {
          email: form.get("email"),
          name: form.get("name"),
          role: form.get("role"),
        },
      });
      setOpen(false);
      refetch();
      if (res.link) setLink(res.link);
      else notify("Invitation envoyée");
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const update = async (user: User, patch: Partial<User>) => {
    try {
      await api(`/api/users/${user.id}`, { method: "PATCH", body: patch });
      refetch();
    } catch (e) {
      notifyError(e);
    }
  };
  const resend = async (user: User) => {
    try {
      const res = await api<{ sent: boolean; link?: string }>(
        `/api/users/${user.id}/resend`,
        { method: "POST" },
      );
      if (res.link) setLink(res.link);
      else notify("Lien envoyé");
    } catch (e) {
      notifyError(e);
    }
  };
  const remove = async (user: User) => {
    if (
      !(await confirmDialog({
        title: `Supprimer ${user.email} ?`,
        danger: true,
      }))
    )
      return;
    await api(`/api/users/${user.id}`, { method: "DELETE" }).catch(notifyError);
    refetch();
  };
  const tone = (s: User["status"]) =>
    s === "active" ? "success" : s === "pending" ? "warning" : "neutral";
  const statusLabel = {
    active: "Actif",
    pending: "En attente",
    disabled: "Désactivé",
  };

  return (
    <>
      <PageHead
        title="Comptes"
        actions={
          <Button variant="solid" icon="plus" onClick={() => setOpen(true)}>
            Inviter
          </Button>
        }
      />
      <Show when={link()}>
        <Notice tone="warning">
          SMTP non configuré | lien à transmettre :{" "}
          <code style={{ "user-select": "all" }}>{link()}</code>
        </Notice>
      </Show>
      <div style={{ "margin-top": "1rem" }}>
        <Table<User>
          caption="Comptes"
          rows={users() ?? []}
          columns={[
            { label: "E-mail", cell: (u) => <strong>{u.email}</strong> },
            { label: "Nom", cell: (u) => u.name },
            {
              label: "Rôle",
              cell: (u) => (
                <select
                  class="ui-input"
                  aria-label={`Rôle de ${u.email}`}
                  style={{
                    "min-height": "2rem",
                    padding: ".2rem .5rem",
                    width: "auto",
                  }}
                  disabled={u.id === me()?.id}
                  onChange={(e) =>
                    update(u, { role: e.currentTarget.value as User["role"] })
                  }
                >
                  <option value="editor" selected={u.role === "editor"}>
                    Éditeur
                  </option>
                  <option value="admin" selected={u.role === "admin"}>
                    Administrateur
                  </option>
                </select>
              ),
            },
            {
              label: "Statut",
              cell: (u) => (
                <Badge tone={tone(u.status)}>{statusLabel[u.status]}</Badge>
              ),
            },
            {
              label: "Créé",
              cell: (u) => (
                <span class="ui-muted">{formatDate(u.createdAt)}</span>
              ),
            },
            {
              label: "Actions",
              hideLabel: true,
              class: "ui-table__actions",
              cell: (u) => (
                <Show when={u.id !== me()?.id}>
                  <Show when={u.status === "pending"}>
                    <Button variant="quiet" size="sm" onClick={() => resend(u)}>
                      Renvoyer
                    </Button>
                  </Show>
                  <Show when={u.status !== "pending"}>
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={() =>
                        update(u, {
                          status: u.status === "active" ? "disabled" : "active",
                        })
                      }
                    >
                      {u.status === "active" ? "Désactiver" : "Réactiver"}
                    </Button>
                  </Show>
                  <Button
                    variant="quiet"
                    size="sm"
                    icon="trash"
                    iconOnly
                    label={`Supprimer ${u.email}`}
                    onClick={() => remove(u)}
                  />
                </Show>
              ),
            },
          ]}
        />
      </div>
      <Modal
        open={open()}
        title="Inviter"
        onClose={() => setOpen(false)}
        footer={
          <Button variant="solid" type="submit" form="invite">
            Envoyer
          </Button>
        }
      >
        <form id="invite" onSubmit={invite}>
          <TextField label="E-mail" name="email" type="email" required />
          <TextField label="Nom" name="name" />
          <SelectField
            label="Rôle"
            name="role"
            value="editor"
            options={[
              { value: "editor", label: "Éditeur" },
              { value: "admin", label: "Administrateur" },
            ]}
          />
          <Show when={error()}>
            <Notice tone="danger">{error()}</Notice>
          </Show>
        </form>
      </Modal>
    </>
  );
}

/* Données : export et import */

export function BackupView() {
  const [busy, setBusy] = createSignal(false);
  const importZip = async (e: SubmitEvent) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget as HTMLFormElement);
    if (!(form.get("file") as File)?.size) return;
    if (
      !(await confirmDialog({
        title: "Importer l'archive",
        message: "Tout le site actuel sera remplacé.",
        confirmLabel: "Remplacer",
        danger: true,
      }))
    )
      return;
    setBusy(true);
    try {
      await api("/api/import", { form });
      window.location.href = "/admin/login";
    } catch (err) {
      notifyError(err);
      setBusy(false);
    }
  };
  return (
    <>
      <PageHead title="Données" />
      <div class="ui-grid">
        <Panel title="Exporter">
          <p class="ui-muted" style={{ margin: "0 0 1rem" }}>
            site.sqlite | media/ | static/
          </p>
          <LinkButton
            variant="solid"
            icon="download"
            href="/api/export"
            download=""
          >
            Télécharger l'archive
          </LinkButton>
        </Panel>
        <Panel title="Importer">
          <form onSubmit={importZip}>
            <TextField
              label="Archive .zip"
              name="file"
              type="file"
              accept=".zip,application/zip"
              required
            />
            <Notice tone="warning">
              Remplace contenus, médias et comptes.
            </Notice>
            <Button
              variant="danger"
              type="submit"
              icon="upload"
              disabled={busy()}
              style={{ "margin-top": "1rem" }}
            >
              Importer
            </Button>
          </form>
        </Panel>
      </div>
    </>
  );
}
