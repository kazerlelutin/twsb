import { type JSX, Show, splitProps } from "solid-js";
import { Icon } from "./icons.view";

export type ButtonVariant = "primary" | "solid" | "ghost" | "quiet" | "danger";

type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: string;
  size?: "sm" | "md";
  /** Bouton icône seule : le libellé devient le nom accessible. */
  iconOnly?: boolean;
  label?: string;
};

export const buttonClass = (
  variant: ButtonVariant = "primary",
  extra?: string,
  size?: string,
  iconOnly?: boolean,
) =>
  [
    "ui-btn",
    `ui-btn--${variant}`,
    size === "sm" && "ui-btn--sm",
    iconOnly && "ui-btn--icon",
    extra,
  ]
    .filter(Boolean)
    .join(" ");

export function Button(props: ButtonProps) {
  const [own, rest] = splitProps(props, [
    "variant",
    "class",
    "icon",
    "size",
    "iconOnly",
    "label",
    "children",
  ]);
  return (
    <button
      type="button"
      aria-label={own.iconOnly ? own.label : undefined}
      title={own.iconOnly ? own.label : undefined}
      {...rest}
      class={buttonClass(own.variant, own.class, own.size, own.iconOnly)}
    >
      <Show when={own.icon}>
        <Icon name={own.icon as string} />
      </Show>
      <Show when={!own.iconOnly}>{own.children ?? own.label}</Show>
    </button>
  );
}

export function LinkButton(
  props: JSX.AnchorHTMLAttributes<HTMLAnchorElement> & {
    variant?: ButtonVariant;
    icon?: string;
    size?: "sm" | "md";
  },
) {
  const [own, rest] = splitProps(props, [
    "variant",
    "class",
    "icon",
    "size",
    "children",
  ]);
  return (
    <a {...rest} class={buttonClass(own.variant, own.class, own.size)}>
      <Show when={own.icon}>
        <Icon name={own.icon as string} />
      </Show>
      {own.children}
    </a>
  );
}
