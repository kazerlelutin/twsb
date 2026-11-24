import {
  createResource,
  createSignal,
  createUniqueId,
  For,
  Index,
  Match,
  Show,
  Switch,
} from "solid-js";
import { NotionEditor } from "../editor/notion-editor.view";
import { slugify } from "../render/html";
import type { ContentField, MediaInfo } from "../site/site.type";
import { Button } from "../ui/button.view";
import { ColorField, SelectField, TextField, Toggle } from "../ui/field.view";
import {
  fetchMedia,
  MediaField,
  MediaPicker,
  Thumb,
} from "./media-library.view";

function GalleryField(props: {
  label: string;
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = createSignal(false);
  return (
    <div class="ui-field">
      <span class="ui-field__label">{props.label}</span>
      <ul class="ui-gallery-field">
        <Index each={props.value}>
          {(id, i) => (
            <li>
              <GalleryThumb id={id()} />
              <Button
                variant="quiet"
                size="sm"
                icon="x"
                iconOnly
                label="Retirer"
                onClick={() =>
                  props.onChange(props.value.filter((_, j) => j !== i))
                }
              />
            </li>
          )}
        </Index>
        <li>
          <Button
            variant="ghost"
            size="sm"
            icon="plus"
            onClick={() => setOpen(true)}
            aria-label={`${props.label} | ajouter`}
          />
        </li>
      </ul>
      <MediaPicker
        open={open()}
        onClose={() => setOpen(false)}
        onSelect={(m: MediaInfo) => props.onChange([...props.value, m.id])}
      />
    </div>
  );
}

function GalleryThumb(props: { id: string }) {
  const [media] = createResource(() => props.id, fetchMedia);
  return (
    <span class="ui-media-pick__thumb">
      <Thumb media={media()} />
    </span>
  );
}

const str = (v: unknown) =>
  typeof v === "string" ? v : v === undefined || v === null ? "" : String(v);

/** Saisie d'un champ, adaptée à son type. */
export function FieldEditor(props: {
  field: ContentField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const f = props.field;
  const label = f.required ? `${f.label} *` : f.label;
  const value = () => props.value;
  const set = (_key: string, next: unknown) => props.onChange(next);
  return (
    <Switch
      fallback={
        <TextField
          placeholder="Vide"
          label={label}
          value={str(value())}
          onInput={(e) => set(f.key, e.currentTarget.value)}
        />
      }
    >
      <Match when={f.type === "textarea"}>
        <div class="ui-field ui-field--block">
          <span class="ui-field__label">{label}</span>
          <NotionEditor
            variant="plain"
            label={f.label}
            value={str(value())}
            onChange={(html) => set(f.key, html)}
          />
        </div>
      </Match>
      <Match when={f.type === "richtext"}>
        <div class="ui-field ui-field--block">
          <span class="ui-field__label">{label}</span>
          <NotionEditor
            variant="field"
            label={f.label}
            value={str(value())}
            onChange={(html) => set(f.key, html)}
          />
        </div>
      </Match>
      <Match when={f.type === "number"}>
        <TextField
          placeholder="Vide"
          label={label}
          type="number"
          value={str(value())}
          onInput={(e) =>
            set(
              f.key,
              e.currentTarget.value === ""
                ? null
                : Number(e.currentTarget.value),
            )
          }
        />
      </Match>
      <Match when={f.type === "date"}>
        <TextField
          placeholder="Vide"
          label={label}
          type="date"
          value={str(value())}
          onInput={(e) => set(f.key, e.currentTarget.value)}
        />
      </Match>
      <Match when={f.type === "toggle"}>
        <Toggle
          label={label}
          checked={value() === true}
          onChange={(v) => set(f.key, v)}
        />
      </Match>
      <Match when={f.type === "select"}>
        <SelectField
          label={label}
          empty="Choisir"
          value={str(value())}
          options={(f.options ?? []).map((o) => ({
            value: o,
            label: o,
          }))}
          onChange={(e) => set(f.key, e.currentTarget.value)}
        />
      </Match>
      <Match when={f.type === "media"}>
        <MediaField
          label={label}
          value={str(value())}
          onChange={(id) => set(f.key, id)}
        />
      </Match>
      <Match when={f.type === "gallery"}>
        <GalleryField
          label={label}
          value={Array.isArray(value()) ? (value() as string[]) : []}
          onChange={(ids) => set(f.key, ids)}
        />
      </Match>
      <Match when={f.type === "url"}>
        <TextField
          label={label}
          type="text"
          inputMode="url"
          placeholder="/page ou https://"
          value={str(value())}
          onInput={(e) => set(f.key, e.currentTarget.value)}
        />
      </Match>
      <Match when={f.type === "email"}>
        <TextField
          placeholder="Vide"
          label={label}
          type="email"
          value={str(value())}
          onInput={(e) => set(f.key, e.currentTarget.value)}
        />
      </Match>
      <Match when={f.type === "color"}>
        <ColorField
          label={label}
          value={str(value())}
          onChange={(v) => set(f.key, v)}
        />
      </Match>
    </Switch>
  );
}

/** Formulaire des champs d'un contenu, avec la saisie adaptée à chaque type. */
export function FieldsForm(props: {
  fields: ContentField[];
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}) {
  return (
    <div class="ui-fields-form">
      <For each={props.fields}>
        {(f) => (
          <FieldEditor
            field={f}
            value={props.data[f.key]}
            onChange={(value) =>
              props.onChange({ ...props.data, [f.key]: value })
            }
          />
        )}
      </For>
    </div>
  );
}

/** Valeur considérée comme remplie (pour signaler les champs vides). */
export const isFilled = (value: unknown) =>
  Array.isArray(value)
    ? value.length > 0
    : value !== undefined && value !== null && value !== "" && value !== false;

/** Sélecteur du champ à saisir dans la page : le corps, puis chaque champ du type. */
export function FieldPicker(props: {
  items: { key: string; label: string; kind: string; filled: boolean }[];
  value: string;
  onChange: (key: string) => void;
}) {
  const name = createUniqueId();
  return (
    <fieldset class="ui-picker">
      <legend class="ui-field__label">Champs</legend>
      <For each={props.items}>
        {(item) => (
          <label
            class="ui-picker__item"
            classList={{ "ui-picker__item--on": props.value === item.key }}
          >
            <input
              type="radio"
              class="ui-sr"
              name={name}
              value={item.key}
              checked={props.value === item.key}
              onChange={() => props.onChange(item.key)}
            />
            <span class="ui-picker__label">{item.label}</span>
            <span class="ui-picker__kind">{item.kind}</span>
            <span
              class="ui-picker__dot"
              classList={{ "ui-picker__dot--on": item.filled }}
              role="img"
              aria-label={item.filled ? "Rempli" : "Vide"}
            />
          </label>
        )}
      </For>
    </fieldset>
  );
}

/** Saisie de tags : Entrée ou virgule pour ajouter, suggestions des tags existants. */
export function TagInput(props: {
  value: string[];
  suggestions: string[];
  onChange: (tags: string[]) => void;
}) {
  const id = createUniqueId();
  const [text, setText] = createSignal("");
  const add = (raw: string) => {
    const names = raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const next = [...props.value];
    for (const name of names)
      if (!next.some((t) => t.toLowerCase() === name.toLowerCase()))
        next.push(name);
    props.onChange(next);
    setText("");
  };
  return (
    <div class="ui-field">
      <label class="ui-field__label" for={id}>
        Tags
      </label>
      <div class="ui-tags">
        <For each={props.value}>
          {(tag) => (
            <span class="ui-tag">
              {tag}
              <button
                type="button"
                aria-label={`Retirer le tag ${tag}`}
                onClick={() =>
                  props.onChange(props.value.filter((t) => t !== tag))
                }
              >
                ×
              </button>
            </span>
          )}
        </For>
        <input
          id={id}
          class="ui-tags__input"
          list={`${id}-list`}
          value={text()}
          placeholder="Ajouter…"
          onInput={(e) => {
            const v = e.currentTarget.value;
            if (v.endsWith(",")) add(v);
            else setText(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(text());
            } else if (e.key === "Backspace" && !text() && props.value.length) {
              props.onChange(props.value.slice(0, -1));
            }
          }}
          onBlur={() => text() && add(text())}
        />
      </div>
      <datalist id={`${id}-list`}>
        <For each={props.suggestions.filter((s) => !props.value.includes(s))}>
          {(s) => <option value={s} />}
        </For>
      </datalist>
    </div>
  );
}

/** Adresse publique modifiable en ligne, recalculable depuis le titre. */
export function Permalink(props: {
  prefix: string;
  slug: string;
  title: string;
  isHome?: boolean;
  onChange: (slug: string) => void;
}) {
  const id = createUniqueId();
  return (
    <div class="ui-permalink">
      <label for={id} class="ui-sr">
        Adresse
      </label>
      <span class="ui-permalink__base" aria-hidden="true">
        {props.prefix ? `/${props.prefix}/` : "/"}
      </span>
      <input
        id={id}
        class="ui-permalink__input"
        value={props.slug}
        size={Math.max(8, props.slug.length)}
        spellcheck={false}
        onChange={(e) =>
          props.onChange(slugify(e.currentTarget.value) || slugify(props.title))
        }
      />
      <Button
        variant="quiet"
        size="sm"
        icon="undo"
        iconOnly
        label="Recalculer l'adresse depuis le titre"
        disabled={slugify(props.title) === props.slug}
        onClick={() => props.onChange(slugify(props.title))}
      />
      <Show when={props.isHome}>
        <span class="ui-badge ui-badge--accent">Accueil</span>
      </Show>
    </div>
  );
}
