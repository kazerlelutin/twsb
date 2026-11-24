import {
  createSignal,
  For,
  type JSX,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { Icon } from "./icons.view";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  match?: (path: string) => boolean;
};

export function AppShell(props: {
  brand: string;
  context?: string;
  items: NavItem[];
  currentPath: string;
  footer?: JSX.Element;
  children: JSX.Element;
}) {
  const [compact, setCompact] = createSignal(false);
  const [open, setOpen] = createSignal(false);
  let nav: HTMLElement | undefined;
  let trigger: HTMLButtonElement | undefined;

  onMount(() => {
    const media =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(max-width: 44rem)")
        : undefined;
    const update = () => setCompact(media?.matches ?? false);
    const outside = (e: PointerEvent) =>
      open() && !nav?.contains(e.target as Node) && setOpen(false);
    update();
    media?.addEventListener("change", update);
    document.addEventListener("pointerdown", outside);
    onCleanup(() => {
      media?.removeEventListener("change", update);
      document.removeEventListener("pointerdown", outside);
    });
  });

  const current = (item: NavItem) =>
    item.match
      ? item.match(props.currentPath)
      : props.currentPath === item.href;

  return (
    <div class="ui-shell ui-shell--nav">
      <aside class="ui-sidebar">
        <a class="ui-brand" href="/admin">
          <img class="ui-brand__mark" src="/twsb-mark.svg" alt="" />
          {props.brand}
        </a>
        <Show when={props.context}>
          <p class="ui-context">{props.context}</p>
        </Show>
        <nav
          ref={nav}
          class="ui-nav"
          aria-label="Navigation principale"
          onKeyDown={(e) => {
            if (e.key === "Escape" && open()) {
              setOpen(false);
              trigger?.focus();
            }
          }}
        >
          <button
            ref={trigger}
            class="ui-nav__trigger"
            type="button"
            aria-label="Menu"
            aria-controls="ui-primary-nav"
            aria-expanded={open()}
            onClick={() => setOpen(!open())}
          >
            <Icon name={open() ? "x" : "menu"} />
          </button>
          <div
            class="ui-nav__menu"
            id="ui-primary-nav"
            hidden={compact() && !open()}
          >
            <ul class="ui-nav__links">
              <For each={props.items}>
                {(item) => (
                  <li>
                    <a
                      href={item.href}
                      aria-current={current(item) ? "page" : undefined}
                      onClick={() => setOpen(false)}
                    >
                      <Icon name={item.icon} />
                      {item.label}
                    </a>
                  </li>
                )}
              </For>
            </ul>
            <Show when={props.footer}>
              <div class="ui-nav__footer">{props.footer}</div>
            </Show>
          </div>
        </nav>
      </aside>
      <main class="ui-content" id="main">
        {props.children}
      </main>
    </div>
  );
}
