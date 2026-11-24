import { For, type JSX, Show } from "solid-js";
import { Empty } from "./layout.view";

export type Column<T> = {
  label: string;
  cell: (row: T) => JSX.Element;
  class?: string;
  hideLabel?: boolean;
};

export function Table<T>(props: {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  empty?: string;
}) {
  return (
    <Show
      when={props.rows.length}
      fallback={<Empty>{props.empty ?? "Aucun élément"}</Empty>}
    >
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: défilement horizontal au clavier */}
      <section class="ui-table" tabindex="0" aria-label={props.caption}>
        <table>
          <caption class="ui-sr">{props.caption}</caption>
          <thead>
            <tr>
              <For each={props.columns}>
                {(c) => (
                  <th scope="col" class={c.class}>
                    <span classList={{ "ui-sr": c.hideLabel }}>{c.label}</span>
                  </th>
                )}
              </For>
            </tr>
          </thead>
          <tbody>
            <For each={props.rows}>
              {(row) => (
                <tr>
                  <For each={props.columns}>
                    {(c) => <td class={c.class}>{c.cell(row)}</td>}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </section>
    </Show>
  );
}
