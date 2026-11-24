import { createResource, createSignal, For, Show } from "solid-js";
import { mediaUrl } from "../render/blocks.render";
import type { MediaInfo } from "../site/site.type";
import { Button } from "../ui/button.view";
import { TextField } from "../ui/field.view";
import { Icon } from "../ui/icons.view";
import { Empty } from "../ui/layout.view";
import { Modal } from "../ui/modal.view";
import { api, qs } from "./client";
import { notifyError } from "./toast";

export const thumbUrl = (media: MediaInfo) => {
  const small =
    [...media.variants]
      .sort((a, b) => a.width - b.width)
      .find((v) => v.width >= 320) ?? media.variants[0];
  return mediaUrl(media, small?.file);
};

const cache = new Map<string, Promise<MediaInfo | undefined>>();
export const fetchMedia = (id: string) => {
  if (!cache.has(id)) {
    cache.set(
      id,
      api<{ item: MediaInfo }>(`/api/media/${id}`)
        .then((r) => r.item)
        .catch(() => undefined),
    );
  }
  return cache.get(id) as Promise<MediaInfo | undefined>;
};

export const isImage = (media: MediaInfo) => media.mime.startsWith("image/");

export function Thumb(props: { media?: MediaInfo }) {
  return (
    <Show when={props.media} fallback={<Icon name="image" />}>
      {(m) => (
        <Show when={isImage(m())} fallback={<span>{m().ext}</span>}>
          <img src={thumbUrl(m())} alt="" loading="lazy" />
        </Show>
      )}
    </Show>
  );
}

export async function uploadFiles(files: FileList | File[]) {
  const form = new FormData();
  for (const file of Array.from(files)) form.append("file", file);
  const { items } = await api<{ items: MediaInfo[] }>("/api/media", { form });
  return items;
}

export function UploadZone(props: {
  onUploaded: (items: MediaInfo[]) => void;
  accept?: string;
}) {
  const [active, setActive] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  let input: HTMLInputElement | undefined;
  const send = async (files: FileList | null | undefined) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      props.onUploaded(await uploadFiles(files));
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
      if (input) input.value = "";
    }
  };
  return (
    <label
      class="ui-dropzone"
      classList={{ "ui-dropzone--active": active() }}
      onDragOver={(e) => {
        e.preventDefault();
        setActive(true);
      }}
      onDragLeave={() => setActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setActive(false);
        send(e.dataTransfer?.files);
      }}
    >
      <Icon name="upload" />
      <span>{busy() ? "Envoi…" : "Déposer ou choisir des fichiers"}</span>
      <input
        ref={input}
        class="ui-sr"
        type="file"
        multiple
        accept={props.accept ?? "image/*,application/pdf,video/mp4,audio/mpeg"}
        onChange={(e) => send(e.currentTarget.files)}
      />
    </label>
  );
}

export function MediaGrid(props: {
  items: MediaInfo[];
  selected?: string;
  onPick: (media: MediaInfo) => void;
}) {
  return (
    <Show when={props.items.length} fallback={<Empty>Aucun média</Empty>}>
      <ul class="ui-media-grid">
        <For each={props.items}>
          {(item) => (
            <li
              class="ui-media"
              classList={{ "ui-media--selected": props.selected === item.id }}
            >
              <button
                type="button"
                class="ui-media__thumb"
                aria-label={item.alt || item.name}
                aria-pressed={props.selected === item.id}
                onClick={() => props.onPick(item)}
              >
                <Thumb media={item} />
              </button>
              <span class="ui-media__name" title={item.name}>
                {item.name}
              </span>
            </li>
          )}
        </For>
      </ul>
    </Show>
  );
}

/** Sélecteur modal : recherche, envoi et choix d'un média. */
export function MediaPicker(props: {
  open: boolean;
  onClose: () => void;
  onSelect: (media: MediaInfo) => void;
  kind?: "image" | "file";
}) {
  const [q, setQ] = createSignal("");
  const [list, { refetch }] = createResource(
    () => (props.open ? { q: q(), kind: props.kind ?? "image" } : false),
    (f) =>
      api<{ items: MediaInfo[] }>(
        `/api/media${qs({ q: f.q, kind: f.kind, limit: 120 })}`,
      ).then((r) => r.items),
  );
  return (
    <Modal open={props.open} title="Médiathèque" onClose={props.onClose} wide>
      <div class="ui-split">
        <div>
          <TextField
            label="Recherche"
            type="search"
            hideLabel
            placeholder="Rechercher"
            value={q()}
            onInput={(e) => setQ(e.currentTarget.value)}
          />
          <div style={{ "margin-top": "1rem" }}>
            <MediaGrid
              items={list.latest ?? []}
              onPick={(m) => {
                props.onSelect(m);
                props.onClose();
              }}
            />
          </div>
        </div>
        <UploadZone
          accept={props.kind === "file" ? undefined : "image/*"}
          onUploaded={(items) => {
            refetch();
            if (items.length === 1) {
              props.onSelect(items[0]);
              props.onClose();
            }
          }}
        />
      </div>
    </Modal>
  );
}

/** Champ de formulaire : vignette, choisir, retirer. */
export function MediaField(props: {
  label: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = createSignal(false);
  const [media] = createResource(() => props.value || false, fetchMedia);
  return (
    <div class="ui-field">
      <span class="ui-field__label">{props.label}</span>
      <div class="ui-media-pick">
        <span class="ui-media-pick__thumb">
          <Thumb media={props.value ? media() : undefined} />
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          aria-label={`${props.label} | choisir`}
        >
          Choisir
        </Button>
        <Show when={props.value}>
          <Button
            variant="quiet"
            size="sm"
            icon="x"
            iconOnly
            label={`${props.label} | retirer`}
            onClick={() => props.onChange("")}
          />
        </Show>
      </div>
      <MediaPicker
        open={open()}
        onClose={() => setOpen(false)}
        onSelect={(m) => props.onChange(m.id)}
      />
    </div>
  );
}
