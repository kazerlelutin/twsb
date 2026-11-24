import { createResource, createSignal, Show } from "solid-js";
import { mediaUrl } from "../render/blocks.render";
import type { MediaInfo } from "../site/site.type";
import { Button, LinkButton } from "../ui/button.view";
import { confirmDialog } from "../ui/dialog.view";
import { SelectField, TextField } from "../ui/field.view";
import { PageHead } from "../ui/layout.view";
import { Modal } from "../ui/modal.view";
import { api, formatDate, formatSize, qs } from "./client";
import { HistoryButton } from "./history.view";
import { AltField, isImage, MediaGrid, UploadZone } from "./media-library.view";
import { notify, notifyError } from "./toast";

export function MediaView() {
  const [q, setQ] = createSignal("");
  const [kind, setKind] = createSignal("");
  const [selected, setSelected] = createSignal<MediaInfo>();
  const [list, { refetch }] = createResource(
    () => ({ q: q(), kind: kind() }),
    (f) =>
      api<{ items: MediaInfo[]; total: number }>(
        `/api/media${qs({ q: f.q, kind: f.kind, limit: 200 })}`,
      ),
  );

  const save = async (patch: { alt?: string; name?: string }) => {
    const item = selected();
    if (!item) return;
    try {
      const res = await api<{ item: MediaInfo }>(`/api/media/${item.id}`, {
        method: "PATCH",
        body: patch,
      });
      setSelected(res.item);
      refetch();
      notify("Enregistré");
    } catch (e) {
      notifyError(e);
    }
  };
  const remove = async () => {
    const item = selected();
    if (
      !item ||
      !(await confirmDialog({
        title: `Supprimer « ${item.name} » ?`,
        danger: true,
      }))
    )
      return;
    try {
      await api(`/api/media/${item.id}`, { method: "DELETE" });
      setSelected(undefined);
      refetch();
      notify("Supprimé");
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <>
      <PageHead
        title="Médias"
        actions={<span class="ui-muted">{list.latest?.total ?? 0}</span>}
      />
      <div class="ui-media-page">
        <UploadZone
          onUploaded={(items) => {
            refetch();
            notify(
              items.length > 1
                ? `${items.length} fichiers envoyés`
                : "Fichier envoyé",
            );
          }}
        />
        <search class="ui-filters">
          <TextField
            class="ui-field--search"
            label="Recherche"
            type="search"
            value={q()}
            onInput={(e) => setQ(e.currentTarget.value)}
          />
          <SelectField
            label="Type"
            empty="Tous"
            value={kind()}
            options={[
              { value: "image", label: "Images" },
              { value: "file", label: "Fichiers" },
            ]}
            onChange={(e) => setKind(e.currentTarget.value)}
          />
        </search>
        <MediaGrid
          items={list.latest?.items ?? []}
          selected={selected()?.id}
          onPick={setSelected}
        />
      </div>
      <Modal
        open={!!selected()}
        title={selected()?.name ?? ""}
        wide
        onClose={() => setSelected(undefined)}
      >
        <Show when={selected()} keyed>
          {(item) => (
            <div class="ui-media-detail">
              <div class="ui-media-detail__preview">
                <Show
                  when={isImage(item)}
                  fallback={
                    <span class="ui-media-detail__ext">{item.ext}</span>
                  }
                >
                  <img
                    src={previewUrl(item)}
                    alt=""
                    width={item.width ?? undefined}
                    height={item.height ?? undefined}
                  />
                </Show>
              </div>
              <div class="ui-media-detail__info">
                <p class="ui-muted">
                  {[
                    item.width && item.height
                      ? `${item.width} × ${item.height}`
                      : "",
                    formatSize(item.size),
                    formatDate(item.createdAt),
                  ]
                    .filter(Boolean)
                    .join(" | ")}
                </p>
                <Show when={isImage(item) && item.variants.length}>
                  <p class="ui-muted">
                    {item.variants.map((v) => `${v.width}w`).join(" | ")}
                  </p>
                </Show>
                <TextField
                  label="Nom"
                  value={item.name}
                  onChange={(e) => save({ name: e.currentTarget.value })}
                />
                <Show when={isImage(item)}>
                  <AltField
                    media={item}
                    // La grille se met à jour ; la fiche reste ouverte pendant la saisie.
                    onSaved={() => refetch()}
                  />
                </Show>
                <div class="ui-toolbar">
                  <LinkButton
                    variant="ghost"
                    size="sm"
                    icon="external"
                    href={mediaUrl(item)}
                    target="_blank"
                    rel="noopener"
                  >
                    Original
                  </LinkButton>
                  <HistoryButton entity="media" id={item.id} size="sm" />
                  <Button
                    variant="danger"
                    size="sm"
                    icon="trash"
                    onClick={remove}
                  >
                    Supprimer
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Show>
      </Modal>
    </>
  );
}

/** Aperçu de la fiche : la variante la plus proche de 960 px. */
const previewUrl = (media: MediaInfo) => {
  const variant =
    [...media.variants]
      .sort((a, b) => a.width - b.width)
      .find((v) => v.width >= 960) ?? media.variants.at(-1);
  return mediaUrl(media, variant?.file);
};
