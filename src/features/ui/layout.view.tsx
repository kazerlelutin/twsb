import { createUniqueId, type JSX, Show } from "solid-js";

export function PageHead(props: {
  title: string;
  actions?: JSX.Element;
  eyebrow?: string;
}) {
  return (
    <header class="ui-page-head">
      <div>
        <Show when={props.eyebrow}>
          <p class="ui-eyebrow">{props.eyebrow}</p>
        </Show>
        <h1>{props.title}</h1>
      </div>
      <Show when={props.actions}>
        <div class="ui-toolbar">{props.actions}</div>
      </Show>
    </header>
  );
}

export function Panel(props: {
  title?: string;
  eyebrow?: string;
  action?: JSX.Element;
  children: JSX.Element;
  class?: string;
}) {
  const id = createUniqueId();
  return (
    <section
      class={`ui-panel ${props.class ?? ""}`}
      aria-labelledby={props.title ? id : undefined}
    >
      <Show when={props.title || props.action}>
        <div class="ui-panel__head">
          <div>
            <Show when={props.eyebrow}>
              <p class="ui-eyebrow">{props.eyebrow}</p>
            </Show>
            <Show when={props.title}>
              <h2 class="ui-panel__title" id={id}>
                {props.title}
              </h2>
            </Show>
          </div>
          {props.action}
        </div>
      </Show>
      {props.children}
    </section>
  );
}

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

export const Badge = (props: { tone?: Tone; children: JSX.Element }) => (
  <span class={`ui-badge ui-badge--${props.tone ?? "neutral"}`}>
    {props.children}
  </span>
);

export const Notice = (props: {
  tone?: "info" | "success" | "warning" | "danger";
  children: JSX.Element;
}) => (
  <div
    class={`ui-notice ui-notice--${props.tone ?? "info"}`}
    role={props.tone === "danger" ? "alert" : "status"}
  >
    {props.children}
  </div>
);

export const Empty = (props: { children: JSX.Element }) => (
  <div class="ui-empty">{props.children}</div>
);
