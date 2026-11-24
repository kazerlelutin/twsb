import {
  createEffect,
  createResource,
  createSignal,
  For,
  Index,
  Show,
} from "solid-js";
import { blockId } from "../blocks/catalog";
import type { ContentSummary, Menu, MenuItem } from "../site/site.type";
import { Button } from "../ui/button.view";
import { confirmDialog, promptDialog } from "../ui/dialog.view";
import { SelectField, TextField } from "../ui/field.view";
import { Empty, PageHead, Panel } from "../ui/layout.view";
import { api } from "./client";
import { HistoryButton } from "./history.view";
import { session } from "./session";
import { notify, notifyError } from "./toast";

type Flat = { item: MenuItem; depth: number };

const flatten = (items: MenuItem[], depth = 0): Flat[] =>
  items.flatMap((item) => [
    { item: { ...item, children: undefined }, depth },
    ...flatten(item.children ?? [], depth + 1),
  ]);

/** Reconstruit l'arbre à partir de la liste indentée (2 niveaux max). */
const unflatten = (flat: Flat[]): MenuItem[] => {
  const root: MenuItem[] = [];
  let parent: MenuItem | undefined;
  for (const { item, depth } of flat) {
    const node = { ...item, children: undefined as MenuItem[] | undefined };
    if (depth > 0 && parent)
      parent.children = [...(parent.children ?? []), node];
    else {
      root.push(node);
      parent = node;
    }
  }
  return root.map((n) =>
    n.children?.length ? n : { ...n, children: undefined },
  );
};

export function MenusView() {
  const isAdmin = () => session.user()?.role === "admin";
  const [menus, { refetch }] = createResource(() =>
    api<{ items: Menu[] }>("/api/menus").then((r) => r.items),
  );
  const [pages] = createResource(() =>
    api<{ items: ContentSummary[] }>("/api/contents?limit=200").then(
      (r) => r.items,
    ),
  );
  const [currentId, setCurrentId] = createSignal<string>();
  const [name, setName] = createSignal("");
  const [rows, setRows] = createSignal<Flat[]>([]);

  const open = (menu: Menu) => {
    setCurrentId(menu.id);
    setName(menu.name);
    setRows(flatten(menu.items));
  };
  const current = () => menus()?.find((m) => m.id === currentId());

  // Premier menu ouvert d'office (au chargement et après une suppression).
  createEffect(() => {
    const list = menus();
    if (list?.length && !current()) open(list[0]);
  });

  const create = async () => {
    const label = await promptDialog({
      title: "Nouveau menu",
      label: "Nom",
      confirmLabel: "Créer",
    });
    if (!label) return;
    try {
      const { menu } = await api<{ menu: Menu }>("/api/menus", {
        body: { name: label, items: [] },
      });
      await refetch();
      open(menu);
    } catch (e) {
      notifyError(e);
    }
  };
  const save = async () => {
    const id = currentId();
    if (!id) return;
    try {
      await api(`/api/menus/${id}`, {
        method: "PATCH",
        body: { name: name(), items: unflatten(rows()) },
      });
      await refetch();
      notify("Menu enregistré");
    } catch (e) {
      notifyError(e);
    }
  };
  const remove = async () => {
    const menu = current();
    if (
      !menu ||
      !(await confirmDialog({
        title: `Supprimer « ${menu.name} » ?`,
        danger: true,
      }))
    )
      return;
    await api(`/api/menus/${menu.id}`, { method: "DELETE" }).catch(notifyError);
    setCurrentId(undefined);
    refetch();
  };

  const update = (i: number, patch: Partial<Flat>) =>
    setRows(rows().map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const updateItem = (i: number, patch: Partial<MenuItem>) =>
    update(i, { item: { ...rows()[i].item, ...patch } });
  const move = (i: number, delta: number) => {
    const next = [...rows()];
    const j = i + delta;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    if (next[0].depth > 0) next[0] = { ...next[0], depth: 0 };
    setRows(next);
  };

  return (
    <>
      <PageHead
        title="Menus"
        actions={
          <Show when={isAdmin()}>
            <Button variant="solid" icon="plus" onClick={create}>
              Nouveau
            </Button>
          </Show>
        }
      />
      <div class="ui-split ui-split--left">
        <Panel>
          <Show when={menus()?.length} fallback={<Empty>Aucun menu</Empty>}>
            <ul class="ui-nav__links">
              <For each={menus()}>
                {(menu) => (
                  <li>
                    <button
                      type="button"
                      aria-current={
                        menu.id === currentId() ? "true" : undefined
                      }
                      style={
                        menu.id === currentId()
                          ? {
                              "border-left-color": "var(--ui-action-text)",
                              background: "var(--ui-selected)",
                              color: "var(--ui-text)",
                            }
                          : {}
                      }
                      onClick={() => open(menu)}
                    >
                      {menu.name}
                      <span
                        class="ui-muted"
                        style={{ "margin-left": "auto", "font-weight": 500 }}
                      >
                        {menu.id}
                      </span>
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </Panel>
        <Show
          when={current()}
          fallback={
            <Panel>
              <Empty>Choisissez un menu</Empty>
            </Panel>
          }
        >
          <Panel
            title={name()}
            action={
              <div class="ui-toolbar">
                <HistoryButton entity="menu" id={current()?.id ?? ""} />
                <Show when={isAdmin()}>
                  <Button
                    variant="quiet"
                    icon="trash"
                    iconOnly
                    label="Supprimer le menu"
                    onClick={remove}
                  />
                  <Button variant="solid" icon="save" onClick={save}>
                    Enregistrer
                  </Button>
                </Show>
              </div>
            }
          >
            <TextField
              label="Nom"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
            />
            <div style={{ "margin-top": "1rem" }}>
              <Index each={rows()} fallback={<Empty>Aucun lien</Empty>}>
                {(row, i) => (
                  <div
                    class="ui-menu-item"
                    style={{ "margin-left": `${row().depth * 1.75}rem` }}
                  >
                    <TextField
                      label="Libellé"
                      value={row().item.label}
                      onInput={(e) =>
                        updateItem(i, { label: e.currentTarget.value })
                      }
                    />
                    <Show
                      when={row().item.contentId !== undefined}
                      fallback={
                        <TextField
                          label="Lien"
                          value={row().item.url ?? ""}
                          placeholder="/page ou https://"
                          onInput={(e) =>
                            updateItem(i, { url: e.currentTarget.value })
                          }
                        />
                      }
                    >
                      <SelectField
                        label="Contenu"
                        value={row().item.contentId ?? ""}
                        options={(pages() ?? []).map((p) => ({
                          value: p.id,
                          label: p.title,
                        }))}
                        onChange={(e) =>
                          updateItem(i, { contentId: e.currentTarget.value })
                        }
                      />
                    </Show>
                    <div class="ui-toolbar" style={{ "align-self": "end" }}>
                      <Button
                        variant="quiet"
                        size="sm"
                        icon="link"
                        iconOnly
                        label={
                          row().item.contentId !== undefined
                            ? "Lien libre"
                            : "Lier un contenu"
                        }
                        onClick={() =>
                          updateItem(
                            i,
                            row().item.contentId !== undefined
                              ? { contentId: undefined, url: "" }
                              : {
                                  contentId: pages()?.[0]?.id ?? "",
                                  url: undefined,
                                },
                          )
                        }
                      />
                      <Button
                        variant="quiet"
                        size="sm"
                        icon={row().depth ? "outdent" : "indent"}
                        iconOnly
                        label={row().depth ? "Désindenter" : "Sous-menu"}
                        disabled={i === 0}
                        onClick={() =>
                          update(i, { depth: row().depth ? 0 : 1 })
                        }
                      />
                      <Button
                        variant="quiet"
                        size="sm"
                        icon="up"
                        iconOnly
                        label="Monter"
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                      />
                      <Button
                        variant="quiet"
                        size="sm"
                        icon="down"
                        iconOnly
                        label="Descendre"
                        disabled={i === rows().length - 1}
                        onClick={() => move(i, 1)}
                      />
                      <Button
                        variant="quiet"
                        size="sm"
                        icon="trash"
                        iconOnly
                        label="Retirer"
                        onClick={() =>
                          setRows(rows().filter((_, j) => j !== i))
                        }
                      />
                    </div>
                  </div>
                )}
              </Index>
            </div>
            <Button
              variant="ghost"
              icon="plus"
              style={{ "margin-top": "1rem" }}
              onClick={() =>
                setRows([
                  ...rows(),
                  {
                    item: { id: blockId(), label: "Lien", url: "/" },
                    depth: 0,
                  },
                ])
              }
            >
              Lien
            </Button>
          </Panel>
        </Show>
      </div>
    </>
  );
}
