import { createUniqueId, For, type JSX, Show, splitProps } from "solid-js";

type Base = {
  label: string;
  error?: string;
  hideLabel?: boolean;
  class?: string;
  hint?: JSX.Element;
};

function Wrapper(props: Base & { id: string; children: JSX.Element }) {
  return (
    <div class={`ui-field ${props.class ?? ""}`}>
      <label
        class="ui-field__label"
        classList={{ "ui-sr": props.hideLabel }}
        for={props.id}
      >
        {props.label}
        <Show when={props.hint}>
          <span class="ui-field__value">{props.hint}</span>
        </Show>
      </label>
      {props.children}
      <Show when={props.error}>
        <span class="ui-field__error" id={`${props.id}-error`}>
          {props.error}
        </span>
      </Show>
    </div>
  );
}

export function TextField(
  props: Base & JSX.InputHTMLAttributes<HTMLInputElement>,
) {
  const [own, rest] = splitProps(props, [
    "label",
    "error",
    "hideLabel",
    "class",
    "hint",
  ]);
  const id = rest.id ?? createUniqueId();
  return (
    <Wrapper {...own} id={id}>
      <input
        class="ui-input"
        {...rest}
        id={id}
        aria-invalid={own.error ? "true" : undefined}
        aria-describedby={own.error ? `${id}-error` : undefined}
      />
    </Wrapper>
  );
}

export function TextArea(
  props: Base &
    JSX.TextareaHTMLAttributes<HTMLTextAreaElement> & { code?: boolean },
) {
  const [own, rest] = splitProps(props, [
    "label",
    "error",
    "hideLabel",
    "class",
    "code",
    "hint",
  ]);
  const id = rest.id ?? createUniqueId();
  return (
    <Wrapper {...own} id={id}>
      <textarea
        class="ui-input"
        classList={{ "ui-input--code": own.code }}
        {...rest}
        id={id}
        aria-invalid={own.error ? "true" : undefined}
        aria-describedby={own.error ? `${id}-error` : undefined}
      />
    </Wrapper>
  );
}

export type Option = { value: string; label: string };

export function SelectField(
  props: Base &
    JSX.SelectHTMLAttributes<HTMLSelectElement> & {
      options: Option[];
      empty?: string;
    },
) {
  const [own, rest] = splitProps(props, [
    "label",
    "error",
    "hideLabel",
    "class",
    "options",
    "empty",
    "hint",
    "value",
  ]);
  const id = rest.id ?? createUniqueId();
  return (
    <Wrapper {...own} id={id}>
      <select class="ui-input" {...rest} id={id}>
        <Show when={own.empty !== undefined}>
          <option value="" selected={!own.value}>
            {own.empty}
          </option>
        </Show>
        <For each={own.options}>
          {(o) => (
            <option
              value={o.value}
              selected={String(own.value ?? "") === o.value}
            >
              {o.label}
            </option>
          )}
        </For>
      </select>
    </Wrapper>
  );
}

export function Toggle(props: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label class="ui-toggle">
      {props.label}
      <input
        type="checkbox"
        role="switch"
        aria-checked={props.checked}
        checked={props.checked}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.currentTarget.checked)}
      />
    </label>
  );
}

const HEX = /^#[0-9a-f]{6}$/i;

export type ColorPreset = { value: string; label: string; color: string };

/**
 * Couleur : tout le carré ouvre le sélecteur natif (l'input couvre la pastille),
 * les couleurs de la charte sont proposées en un clic.
 */
export function ColorField(
  props: Base & {
    value: string;
    onChange: (value: string) => void;
    allowEmpty?: boolean;
    presets?: ColorPreset[];
  },
) {
  const id = createUniqueId();
  const preset = () => props.presets?.find((p) => p.value === props.value);
  const shown = () => preset()?.color ?? props.value;
  return (
    <Wrapper {...props} id={id}>
      <div class="ui-color">
        <span
          class="ui-color__swatch"
          classList={{
            "ui-color__swatch--empty": !shown() || shown() === "transparent",
          }}
          style={{ "--swatch": shown() || "transparent" }}
        >
          <input
            type="color"
            class="ui-color__native"
            aria-label={`${props.label} | nuancier`}
            value={HEX.test(shown()) ? shown() : "#ffffff"}
            onInput={(e) => props.onChange(e.currentTarget.value)}
          />
        </span>
        <input
          class="ui-input"
          id={id}
          value={preset()?.label ?? props.value}
          placeholder={props.allowEmpty ? "Par défaut" : "#000000"}
          spellcheck={false}
          onChange={(e) => {
            const text = e.currentTarget.value.trim();
            props.onChange(
              props.presets?.find(
                (p) => p.label.toLowerCase() === text.toLowerCase(),
              )?.value ?? text,
            );
          }}
        />
        <Show when={props.allowEmpty && props.value}>
          <button
            type="button"
            class="ui-clear"
            aria-label={`${props.label} | par défaut`}
            title="Par défaut"
            onClick={() => props.onChange("")}
          >
            ×
          </button>
        </Show>
      </div>
      <Show when={props.presets?.length}>
        <fieldset class="ui-color__presets">
          <legend class="ui-sr">{`${props.label} | charte`}</legend>
          <For each={props.presets}>
            {(p) => (
              <button
                type="button"
                class="ui-color__preset"
                classList={{
                  "ui-color__swatch--empty": p.color === "transparent",
                }}
                style={{ "--swatch": p.color }}
                aria-label={p.label}
                title={p.label}
                aria-pressed={props.value === p.value}
                onClick={() => props.onChange(p.value)}
              />
            )}
          </For>
        </fieldset>
      </Show>
    </Wrapper>
  );
}

/** Curseur + saisie ; vide = valeur par défaut, effaçable. */
export function RangeField(
  props: Base & {
    value: number | undefined;
    onChange: (value: number | undefined) => void;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    clearable?: boolean;
  },
) {
  const id = createUniqueId();
  const unset = () => props.value === undefined || Number.isNaN(props.value);
  return (
    <Wrapper {...props} id={id}>
      <div class="ui-range" classList={{ "ui-range--unset": unset() }}>
        <input
          type="range"
          aria-label={props.label}
          min={props.min ?? 0}
          max={props.max ?? 100}
          step={props.step ?? 1}
          value={props.value ?? props.min ?? 0}
          onInput={(e) => props.onChange(Number(e.currentTarget.value))}
        />
        <input
          class="ui-input"
          id={id}
          type="number"
          min={props.min}
          max={props.max}
          step={props.step ?? 1}
          value={props.value ?? ""}
          placeholder="Auto"
          onChange={(e) =>
            props.onChange(
              e.currentTarget.value === ""
                ? undefined
                : Number(e.currentTarget.value),
            )
          }
        />
        <Show when={props.clearable}>
          <button
            type="button"
            class="ui-clear"
            aria-label={`${props.label} | par défaut`}
            title="Par défaut"
            disabled={unset()}
            onClick={() => props.onChange(undefined)}
          >
            ×
          </button>
        </Show>
      </div>
    </Wrapper>
  );
}

export function Segmented<T extends string>(props: {
  label: string;
  value: T;
  options: { value: T; label: string; icon?: JSX.Element }[];
  onChange: (value: T) => void;
  iconOnly?: boolean;
}) {
  return (
    <fieldset class="ui-segmented">
      <legend class="ui-sr">{props.label}</legend>
      <For each={props.options}>
        {(o) => (
          <button
            type="button"
            aria-pressed={props.value === o.value}
            aria-label={props.iconOnly ? o.label : undefined}
            title={props.iconOnly ? o.label : undefined}
            onClick={() => props.onChange(o.value)}
          >
            {o.icon}
            <Show when={!props.iconOnly}>{o.label}</Show>
          </button>
        )}
      </For>
    </fieldset>
  );
}
