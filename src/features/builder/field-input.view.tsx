import { createUniqueId, For, Index, Match, Show, Switch } from "solid-js";
import { MediaField } from "../admin/media-library.view";
import type { FieldDef, Spacing } from "../blocks/block.type";
import { NotionEditor } from "../editor/notion-editor.view";
import { Button } from "../ui/button.view";
import {
  ColorField,
  type ColorPreset,
  RangeField,
  SelectField,
  TextArea,
  TextField,
  Toggle,
} from "../ui/field.view";

type Option = { value: string; label: string };

export type FieldContext = {
  menus: Option[];
  types: Option[];
  links: Option[];
  tags: Option[];
  contentFields: Option[];
  colors: ColorPreset[];
  linksId: string;
};

/** Une valeur hors liste (ex. répartition ajustée à la souris) reste affichée. */
const withCurrent = (options: Option[], value: string) =>
  value && !options.some((o) => o.value === value)
    ? [...options, { value, label: value.replaceAll("-", " | ") }]
    : options;

type Props = {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  ctx: FieldContext;
};

const asString = (v: unknown) =>
  typeof v === "string" ? v : v === undefined || v === null ? "" : String(v);
const asNumber = (v: unknown) =>
  v === undefined || v === null || v === "" ? undefined : Number(v);

function SpacingInput(props: {
  label: string;
  value: Spacing | undefined;
  onChange: (v: Spacing | undefined) => void;
}) {
  const sides = [
    ["top", "Haut"],
    ["right", "Droite"],
    ["bottom", "Bas"],
    ["left", "Gauche"],
  ] as const;
  return (
    <fieldset
      class="ui-field"
      style={{ border: 0, padding: 0, "min-inline-size": 0 }}
    >
      <legend class="ui-field__label">{props.label}</legend>
      <div class="ui-spacing">
        <For each={sides}>
          {([key, label]) => (
            <label>
              <input
                class="ui-input"
                type="number"
                min="0"
                max="400"
                step="4"
                value={props.value?.[key] ?? ""}
                onChange={(e) => {
                  const raw = e.currentTarget.value;
                  const next = { ...(props.value ?? {}) } as Spacing;
                  if (raw === "") delete next[key];
                  else next[key] = Number(raw);
                  props.onChange(Object.keys(next).length ? next : undefined);
                }}
              />
              {label}
            </label>
          )}
        </For>
      </div>
    </fieldset>
  );
}

function ListInput(props: Props) {
  const items = () =>
    Array.isArray(props.value)
      ? (props.value as Record<string, unknown>[])
      : [];
  const set = (next: Record<string, unknown>[]) => props.onChange(next);
  const blank = () =>
    Object.fromEntries(
      (props.field.fields ?? []).map((f) => [
        f.key,
        f.type === "toggle" ? false : "",
      ]),
    );
  const title = (item: Record<string, unknown>, i: number) => {
    const first = (props.field.fields ?? []).find((f) => f.type === "text");
    return (
      asString(first ? item[first.key] : "") ||
      `${props.field.itemLabel ?? "Élément"} ${i + 1}`
    );
  };
  return (
    <div class="ui-field">
      <span class="ui-field__label">{props.field.label}</span>
      <div class="ui-list-field">
        <Index each={items()}>
          {(item, i) => (
            <details class="ui-list-item">
              <summary>
                <span>{title(item(), i)}</span>
                <Button
                  variant="quiet"
                  size="sm"
                  icon="up"
                  iconOnly
                  label="Monter"
                  disabled={i === 0}
                  onClick={(e) => {
                    e.preventDefault();
                    const next = [...items()];
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    set(next);
                  }}
                />
                <Button
                  variant="quiet"
                  size="sm"
                  icon="trash"
                  iconOnly
                  label="Supprimer"
                  onClick={(e) => {
                    e.preventDefault();
                    set(items().filter((_, j) => j !== i));
                  }}
                />
              </summary>
              <div class="ui-list-item__body">
                <For each={props.field.fields ?? []}>
                  {(sub) => (
                    <FieldInput
                      field={sub}
                      ctx={props.ctx}
                      value={item()[sub.key]}
                      onChange={(v) =>
                        set(
                          items().map((it, j) =>
                            j === i ? { ...it, [sub.key]: v } : it,
                          ),
                        )
                      }
                    />
                  )}
                </For>
              </div>
            </details>
          )}
        </Index>
        <Button
          variant="ghost"
          size="sm"
          icon="plus"
          onClick={() => set([...items(), blank()])}
        >
          {props.field.itemLabel ?? "Ajouter"}
        </Button>
      </div>
    </div>
  );
}

/** Saisie générique d'une propriété de bloc selon son type de champ. */
export function FieldInput(props: Props) {
  const f = () => props.field;
  return (
    <Switch>
      <Match when={f().type === "text"}>
        <TextField
          label={f().label}
          value={asString(props.value)}
          onInput={(e) => props.onChange(e.currentTarget.value)}
        />
      </Match>
      <Match when={f().type === "textarea"}>
        <TextArea
          label={f().label}
          rows={3}
          value={asString(props.value)}
          onInput={(e) => props.onChange(e.currentTarget.value)}
        />
      </Match>
      <Match when={f().type === "code"}>
        <TextArea
          label={f().label}
          code
          rows={6}
          spellcheck={false}
          value={asString(props.value)}
          onChange={(e) => props.onChange(e.currentTarget.value)}
        />
      </Match>
      <Match when={f().type === "richtext"}>
        <div class="ui-field">
          <span class="ui-field__label">{f().label}</span>
          <NotionEditor
            compact
            label={f().label}
            placeholder="Votre texte"
            value={asString(props.value)}
            onChange={(html) => props.onChange(html)}
          />
        </div>
      </Match>
      <Match when={f().type === "number"}>
        <TextField
          label={f().label}
          type="number"
          value={asString(props.value)}
          onInput={(e) => props.onChange(asNumber(e.currentTarget.value))}
        />
      </Match>
      <Match when={f().type === "range"}>
        <RangeField
          label={f().label}
          value={asNumber(props.value)}
          min={f().min}
          max={f().max}
          step={f().step}
          unit={f().unit}
          clearable
          hint={
            props.value !== undefined && props.value !== ""
              ? `${props.value}${f().unit ?? ""}`
              : undefined
          }
          onChange={(v) => props.onChange(v)}
        />
      </Match>
      <Match when={f().type === "color"}>
        <ColorField
          label={f().label}
          allowEmpty
          presets={props.ctx.colors}
          value={asString(props.value)}
          onChange={(v) => props.onChange(v || undefined)}
        />
      </Match>
      <Match when={f().type === "select"}>
        <SelectField
          label={f().label}
          value={asString(props.value)}
          options={withCurrent(f().options ?? [], asString(props.value))}
          onChange={(e) => props.onChange(e.currentTarget.value)}
        />
      </Match>
      <Match when={f().type === "toggle"}>
        <Toggle
          label={f().label}
          checked={props.value === true}
          onChange={(v) => props.onChange(v)}
        />
      </Match>
      <Match when={f().type === "media"}>
        <MediaField
          label={f().label}
          value={asString(props.value)}
          onChange={(v) => props.onChange(v || undefined)}
        />
      </Match>
      <Match when={f().type === "url"}>
        <TextField
          label={f().label}
          value={asString(props.value)}
          list={props.ctx.linksId}
          placeholder="/page ou https://"
          onInput={(e) => props.onChange(e.currentTarget.value)}
        />
      </Match>
      <Match when={f().type === "menu"}>
        <SelectField
          label={f().label}
          value={asString(props.value)}
          options={props.ctx.menus}
          onChange={(e) => props.onChange(e.currentTarget.value)}
        />
      </Match>
      <Match when={f().type === "contentType"}>
        <SelectField
          label={f().label}
          value={asString(props.value)}
          options={props.ctx.types}
          onChange={(e) => props.onChange(e.currentTarget.value)}
        />
      </Match>
      <Match when={f().type === "tag"}>
        <SelectField
          label={f().label}
          value={asString(props.value)}
          options={props.ctx.tags}
          onChange={(e) => props.onChange(e.currentTarget.value)}
        />
      </Match>
      <Match when={f().type === "contentField"}>
        <SelectField
          label={f().label}
          empty="Choisir"
          value={asString(props.value)}
          options={props.ctx.contentFields}
          onChange={(e) => props.onChange(e.currentTarget.value)}
        />
      </Match>
      <Match when={f().type === "spacing"}>
        <SpacingInput
          label={f().label}
          value={props.value as Spacing | undefined}
          onChange={(v) => props.onChange(v)}
        />
      </Match>
      <Match when={f().type === "list"}>
        <ListInput {...props} />
      </Match>
    </Switch>
  );
}

export function LinksDatalist(props: {
  id: string;
  links: { value: string; label: string }[];
}) {
  return (
    <datalist id={props.id}>
      <For each={props.links}>
        {(l) => <option value={l.value}>{l.label}</option>}
      </For>
    </datalist>
  );
}

export const newLinksId = () => `links-${createUniqueId()}`;

export { Show };
