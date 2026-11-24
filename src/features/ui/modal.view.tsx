import {
  createEffect,
  createUniqueId,
  type JSX,
  onCleanup,
  Show,
} from "solid-js";
import { Button } from "./button.view";

/** Dialogue natif : focus piégé, Échap et retour du focus gérés par le navigateur. */
export function Modal(props: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: JSX.Element;
  footer?: JSX.Element;
  wide?: boolean;
}) {
  let dialog: HTMLDialogElement | undefined;
  const id = createUniqueId();
  createEffect(() => {
    if (!dialog) return;
    if (props.open && !dialog.open) dialog.showModal?.();
    if (!props.open && dialog.open) dialog.close();
  });
  onCleanup(() => dialog?.open && dialog.close());
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Échap est géré par l'événement cancel natif
    <dialog
      ref={dialog}
      class="ui-modal"
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        props.onClose();
      }}
      onClick={(e) => e.target === e.currentTarget && props.onClose()}
    >
      <Show when={props.open}>
        <div
          class="ui-modal__box"
          classList={{ "ui-modal__box--wide": props.wide }}
        >
          <div class="ui-modal__head">
            <h2 class="ui-modal__title" id={id}>
              {props.title}
            </h2>
            <Button
              variant="quiet"
              icon="x"
              iconOnly
              label="Fermer"
              onClick={props.onClose}
            />
          </div>
          <div class="ui-modal__body">{props.children}</div>
          <Show when={props.footer}>
            <div class="ui-modal__foot">{props.footer}</div>
          </Show>
        </div>
      </Show>
    </dialog>
  );
}

export function Dropdown(props: {
  label: string;
  icon?: string;
  variant?: "primary" | "solid" | "ghost";
  items: { label: string; onSelect: () => void }[];
}) {
  let root: HTMLDivElement | undefined;
  let open = false;
  const menuId = createUniqueId();
  const toggle = (value: boolean) => {
    open = value;
    const menu = root?.querySelector("ul");
    const button = root?.querySelector("button");
    if (menu) menu.hidden = !value;
    button?.setAttribute("aria-expanded", String(value));
    if (value) queueMicrotask(() => menu?.querySelector("button")?.focus());
  };
  const outside = (e: PointerEvent) =>
    open && !root?.contains(e.target as Node) && toggle(false);
  document.addEventListener("pointerdown", outside);
  onCleanup(() => document.removeEventListener("pointerdown", outside));
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: fermeture au clavier du menu
    <div
      class="ui-dropdown"
      ref={root}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          toggle(false);
          root?.querySelector("button")?.focus();
        }
      }}
    >
      <Button
        variant={props.variant ?? "solid"}
        icon={props.icon}
        aria-haspopup="true"
        aria-expanded="false"
        aria-controls={menuId}
        onClick={() => toggle(!open)}
      >
        {props.label}
      </Button>
      <ul class="ui-dropdown__menu" id={menuId} hidden>
        {props.items.map((item) => (
          <li>
            <button
              type="button"
              onClick={() => {
                toggle(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
