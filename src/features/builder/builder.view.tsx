import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  type JSX,
  on,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { api } from "../admin/client";
import type {
  Block,
  BlockStyle,
  Device,
  EditorScope,
  FieldDef,
} from "../blocks/block.type";
import {
  blockDef,
  CATEGORY_LABELS,
  createBlock,
  FIELD_PREFIX,
  fieldKind,
  isFieldBlock,
  paletteFor,
  STYLE_FIELDS,
} from "../blocks/catalog";
import {
  type DropTarget,
  duplicateBlock,
  insertBlock,
  insertInZones,
  locate,
  moveBlock,
  moveInZones,
  removeBlock,
  updateBlock,
  type Zones,
  zoneOf,
} from "../blocks/tree.service";
import {
  CONTENT_FIELD_TYPES,
  type ContentField,
  type ContentSummary,
  type ContentType,
  type Identity,
  type Menu,
  type Tag,
} from "../site/site.type";
import { Button } from "../ui/button.view";
import { Segmented, SelectField } from "../ui/field.view";
import { Icon } from "../ui/icons.view";
import {
  type FieldContext,
  FieldInput,
  LinksDatalist,
  newLinksId,
} from "./field-input.view";
import { blockLabel, Layers } from "./layers.view";

export type { Zones };

type Props = {
  scope: EditorScope;
  zones: { key: string; label: string }[];
  value: Zones;
  onChange: (value: Zones) => void;
  preview: (value: Zones) => Record<string, unknown>;
  bar: JSX.Element;
  actions: JSX.Element;
  settings: JSX.Element;
  settingsTitle?: string;
  /** Champs du type, proposés au bloc « Champ » des modèles. */
  contentFields?: ContentField[];
};

const HISTORY = 80;

/** Écrit une valeur à un chemin « items.0.title » dans les propriétés d'un bloc. */
function setPath(
  props: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const [head, ...rest] = path.split(".");
  if (!rest.length) return { ...props, [head]: value };
  const child = props[head];
  if (Array.isArray(child)) {
    const index = Number(rest[0]);
    const next = [...child];
    next[index] =
      rest.length > 1
        ? setPath({ ...(next[index] ?? {}) }, rest.slice(1).join("."), value)
        : value;
    return { ...props, [head]: next };
  }
  return {
    ...props,
    [head]: setPath(
      { ...((child as Record<string, unknown>) ?? {}) },
      rest.join("."),
      value,
    ),
  };
}

const visible = (
  field: FieldDef,
  values: Record<string, unknown>,
  type: string,
) => !field.when || field.when(values, { type });

/** Éditeur visuel : palette, structure, aperçu modifiable, inspecteur. */
export function Builder(props: Props) {
  const [zone, setZone] = createSignal(props.zones[0].key);
  const [selected, setSelected] = createSignal<string>();
  const [device, setDevice] = createSignal<Device>("desktop");
  const [tab, setTab] = createSignal<"content" | "style">("content");
  const [html, setHtml] = createSignal("");
  let frame: HTMLIFrameElement | undefined;
  let past: Zones[] = [];
  let future: Zones[] = [];
  const [historyTick, setHistoryTick] = createSignal(0);
  const linksId = newLinksId();

  const [ctxData] = createResource(async () => {
    const [menus, types, contents, tags, identity] = await Promise.all([
      api<{ items: Menu[] }>("/api/menus"),
      api<{ items: ContentType[] }>("/api/types"),
      api<{ items: ContentSummary[] }>(
        "/api/contents?limit=200&status=published",
      ),
      api<{ items: Tag[] }>("/api/tags"),
      api<{ identity: Identity }>("/api/identity"),
    ]);
    const c = identity.identity.colors;
    return {
      menus: menus.items.map((m) => ({ value: m.id, label: m.name })),
      types: [
        { value: "", label: "Tous les types" },
        ...types.items.map((t) => ({ value: t.id, label: t.name })),
      ],
      links: contents.items.map((x) => ({ value: x.url, label: x.title })),
      tags: [
        { value: "", label: "Tous les tags" },
        ...tags.items.map((t) => ({ value: t.id, label: t.name })),
      ],
      colors: [
        { value: "var(--ws-primary)", label: "Principale", color: c.primary },
        {
          value: "var(--ws-secondary)",
          label: "Secondaire",
          color: c.secondary,
        },
        { value: "var(--ws-text)", label: "Texte", color: c.text },
        { value: "var(--ws-bg)", label: "Fond", color: c.background },
        { value: "var(--ws-surface)", label: "Surface", color: c.surface },
        { value: "var(--ws-muted)", label: "Atténuée", color: c.muted },
        { value: "#ffffff", label: "Blanc", color: "#ffffff" },
        { value: "transparent", label: "Transparent", color: "transparent" },
      ],
    };
  });
  const fieldCtx = (): FieldContext => ({
    menus: [],
    types: [],
    links: [],
    tags: [],
    colors: [],
    ...ctxData(),
    contentFields: (props.contentFields ?? []).map((f) => ({
      value: f.key,
      label: f.label,
    })),
    linksId,
  });

  const blocks = () => props.value[zone()] ?? [];
  const current = createMemo(() => {
    const id = selected();
    if (!id) return undefined;
    for (const z of props.zones) {
      const found = locate(props.value[z.key] ?? [], id);
      if (found) return found.block;
    }
    return undefined;
  });

  let lastKey = "";
  let lastTime = 0;
  /** Les frappes rapprochées sur un même champ forment une seule étape d'historique. */
  const commitZones = (next: Zones, key = "") => {
    if (next === props.value) return;
    const t = Date.now();
    if (!key || key !== lastKey || t - lastTime > 800)
      past = [...past.slice(-HISTORY), props.value];
    lastKey = key;
    lastTime = t;
    future = [];
    setHistoryTick((n) => n + 1);
    props.onChange(next);
  };
  /** Applique une transformation à la zone qui contient le bloc. */
  const inZoneOf = (id: string, fn: (list: Block[]) => Block[], key = "") => {
    const z = zoneOf(props.value, id) ?? zone();
    commitZones({ ...props.value, [z]: fn(props.value[z] ?? []) }, key);
  };
  const undo = () => {
    const prev = past.pop();
    if (!prev) return;
    future.push(props.value);
    setHistoryTick((n) => n + 1);
    props.onChange(prev);
  };
  const redo = () => {
    const next = future.pop();
    if (!next) return;
    past.push(props.value);
    setHistoryTick((n) => n + 1);
    props.onChange(next);
  };

  /** Un bloc simple posé à la racine est enveloppé dans une section. */
  const wrapIfRoot = (block: Block, atRoot: boolean): Block => {
    const def = blockDef(block.type);
    return atRoot && !def?.container
      ? { ...createBlock("section"), children: [block] }
      : block;
  };

  const add = (type: string) => {
    const block = createBlock(type);
    const target = selected();
    if (target && zoneOf(props.value, target)) {
      inZoneOf(target, (list) => insertBlock(list, block, target));
    } else {
      commitZones({
        ...props.value,
        [zone()]: [...blocks(), wrapIfRoot(block, true)],
      });
    }
    setSelected(block.id);
  };

  const insertAt = (type: string, target: DropTarget) => {
    const block = createBlock(type);
    const atRoot =
      !target.id ||
      (target.position !== "inside" &&
        !locate(
          props.value[zoneOf(props.value, target.id) ?? ""] ?? [],
          target.id,
        )?.parent);
    commitZones(
      insertInZones(props.value, wrapIfRoot(block, atRoot), target, zone()),
    );
    setSelected(block.id);
  };

  const setProp = (id: string, path: string, value: unknown) =>
    inZoneOf(
      id,
      (list) =>
        updateBlock(list, id, (b) => ({
          ...b,
          props: setPath(b.props ?? {}, path, value),
        })),
      `${id}:${path}`,
    );

  /** Change la saisie d'un bloc-champ en gardant son nom, sa clé et ses réglages. */
  const changeKind = (id: string, kind: string) =>
    inZoneOf(id, (list) =>
      updateBlock(list, id, (b) => ({
        ...b,
        type: `${FIELD_PREFIX}${kind}`,
        props: {
          ...(blockDef(`${FIELD_PREFIX}${kind}`)?.defaults() ?? {}),
          ...b.props,
        },
      })),
    );

  const setStyles = (id: string, values: Record<string, unknown>) =>
    inZoneOf(
      id,
      (list) =>
        updateBlock(list, id, (b) => {
          const style = { ...(b.style ?? {}) };
          const forDevice: Record<string, unknown> = {
            ...(style[device()] ?? {}),
          };
          for (const [key, value] of Object.entries(values)) {
            if (value === undefined || value === "" || value === null)
              delete forDevice[key];
            else forDevice[key] = value;
          }
          style[device()] = forDevice as BlockStyle;
          return { ...b, style };
        }),
      `${id}:style.${Object.keys(values).join(",")}`,
    );

  const remove = (id = selected()) => {
    if (!id) return;
    const z = zoneOf(props.value, id);
    const found = z ? locate(props.value[z], id) : undefined;
    if (!found || found.block.type === "column") return;
    inZoneOf(id, (list) => removeBlock(list, id));
    setSelected(found.parent?.id);
  };
  const act = (action: string, id: string) => {
    if (action === "delete") remove(id);
    else if (action === "duplicate")
      inZoneOf(id, (list) => duplicateBlock(list, id));
    else if (action === "up") inZoneOf(id, (list) => moveBlock(list, id, -1));
    else if (action === "down") inZoneOf(id, (list) => moveBlock(list, id, 1));
  };

  // Aperçu : rendu serveur réel, rafraîchi après une courte pause.
  let timer: ReturnType<typeof setTimeout> | undefined;
  let scroll = 0;
  createEffect(
    on(
      () => props.value,
      () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          try {
            const res = await fetch("/api/preview", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(props.preview(props.value)),
            });
            if (res.ok) {
              scroll = frame?.contentWindow?.scrollY ?? 0;
              setHtml(await res.text());
            }
          } catch {
            /* aperçu indisponible : on garde le précédent */
          }
        }, 200);
      },
    ),
  );
  onCleanup(() => clearTimeout(timer));

  const sendSelection = (scrollTo = false) =>
    frame?.contentWindow?.postMessage(
      {
        source: "ws-editor",
        type: "select",
        id: selected() ?? null,
        scroll: scrollTo,
      },
      "*",
    );
  createEffect(on(selected, () => sendSelection(true), { defer: true }));

  const keyAction = (e: {
    key: string;
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
  }) => {
    const key = e.key.toLowerCase();
    if (e.ctrl && key === "z") (e.shift ? redo : undo)();
    else if (e.ctrl && key === "y") redo();
    else if (e.ctrl && key === "d" && selected())
      act("duplicate", selected() as string);
    else if (e.alt && e.key === "ArrowUp" && selected())
      act("up", selected() as string);
    else if (e.alt && e.key === "ArrowDown" && selected())
      act("down", selected() as string);
    else if ((e.key === "Delete" || e.key === "Backspace") && selected())
      remove();
    else if (e.key === "Escape" && selected()) setSelected(undefined);
    else return false;
    return true;
  };

  onMount(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data;
      if (e.source !== frame?.contentWindow || d?.source !== "ws-preview")
        return;
      switch (d.type) {
        case "ready":
          frame?.contentWindow?.scrollTo(0, scroll);
          sendSelection();
          break;
        case "select": {
          const id = d.id ? String(d.id) : undefined;
          const z = id ? zoneOf(props.value, id) : undefined;
          if (z) setZone(z);
          setSelected(z ? id : undefined);
          break;
        }
        case "move":
          commitZones(
            moveInZones(props.value, String(d.id), d.target as DropTarget),
          );
          break;
        case "insert":
          if (blockDef(String(d.blockType)))
            insertAt(String(d.blockType), d.target as DropTarget);
          break;
        case "prop":
          if (d.id && d.path) setProp(String(d.id), String(d.path), d.value);
          break;
        case "style":
          if (d.id) setStyles(String(d.id), d.values ?? {});
          break;
        case "action":
          if (d.id) act(String(d.action), String(d.id));
          break;
        case "key":
          if (d.key === "s")
            window.dispatchEvent(
              new KeyboardEvent("keydown", { key: "s", ctrlKey: true }),
            );
          else
            keyAction({
              key: String(d.key),
              ctrl: true,
              shift: !!d.shift,
              alt: false,
            });
          break;
      }
    };
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest(
        "input, textarea, select, [contenteditable='true']",
      );
      if (typing) return;
      if (
        keyAction({
          key: e.key,
          ctrl: e.ctrlKey || e.metaKey,
          shift: e.shiftKey,
          alt: e.altKey,
        })
      )
        e.preventDefault();
    };
    window.addEventListener("message", onMessage);
    window.addEventListener("keydown", onKey);
    onCleanup(() => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("keydown", onKey);
    });
  });

  const groups = createMemo(() => {
    const map = new Map<string, ReturnType<typeof paletteFor>>();
    for (const def of paletteFor(props.scope))
      map.set(def.category, [...(map.get(def.category) ?? []), def]);
    return [...map.entries()];
  });

  const style = () =>
    (current()?.style?.[device()] ?? {}) as Record<string, unknown>;
  /** Pour les conditions : le mobile hérite des réglages ordinateur. */
  const effectiveStyle = () => ({
    ...(current()?.style?.desktop ?? {}),
    ...(device() === "mobile" ? (current()?.style?.mobile ?? {}) : {}),
  });

  return (
    <div class="ui-builder">
      <div class="ui-builder__bar">
        {props.bar}
        <Segmented<Device>
          label="Appareil"
          iconOnly
          value={device()}
          onChange={setDevice}
          options={[
            {
              value: "desktop",
              label: "Ordinateur",
              icon: <Icon name="desktop" />,
            },
            { value: "mobile", label: "Mobile", icon: <Icon name="mobile" /> },
          ]}
        />
        <Button
          variant="quiet"
          icon="undo"
          iconOnly
          label="Annuler (Ctrl+Z)"
          disabled={(historyTick(), past.length === 0)}
          onClick={undo}
        />
        <Button
          variant="quiet"
          icon="redo"
          iconOnly
          label="Rétablir (Ctrl+Maj+Z)"
          disabled={(historyTick(), future.length === 0)}
          onClick={redo}
        />
        {props.actions}
      </div>
      <div class="ui-builder__body">
        <aside class="ui-builder__side" aria-label="Blocs">
          <div class="ui-builder__section">
            <h2>Ajouter</h2>
            <For each={groups()}>
              {([category, defs]) => (
                <div class="ui-palette-group">
                  <h3>{CATEGORY_LABELS[category]}</h3>
                  <div class="ui-palette">
                    <For each={defs}>
                      {(def) => (
                        <button
                          type="button"
                          draggable={true}
                          title="Cliquer pour ajouter, ou glisser dans l'aperçu"
                          onClick={() => add(def.type)}
                          onDragStart={(e) => {
                            e.dataTransfer?.setData(
                              "text/x-ws-insert",
                              def.type,
                            );
                            if (e.dataTransfer)
                              e.dataTransfer.effectAllowed = "copy";
                          }}
                        >
                          <span class="ui-palette__icon" aria-hidden="true">
                            {def.icon}
                          </span>
                          {def.label}
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              )}
            </For>
          </div>
          <For each={props.zones}>
            {(z) => (
              <div class="ui-builder__section">
                <h2>{props.zones.length > 1 ? z.label : "Structure"}</h2>
                <Show
                  when={(props.value[z.key] ?? []).length}
                  fallback={<p class="ui-muted">Vide</p>}
                >
                  <Layers
                    blocks={props.value[z.key] ?? []}
                    selected={selected()}
                    onSelect={(id) => {
                      setZone(z.key);
                      setSelected(id);
                    }}
                    onMove={(id, target, position) =>
                      commitZones(
                        moveInZones(props.value, id, { id: target, position }),
                      )
                    }
                  />
                </Show>
              </div>
            )}
          </For>
        </aside>

        <section class="ui-builder__canvas" aria-label="Aperçu">
          <iframe
            ref={frame}
            class="ui-builder__frame"
            classList={{ "ui-builder__frame--mobile": device() === "mobile" }}
            title="Aperçu de la page"
            srcdoc={html()}
          />
        </section>

        <aside
          class="ui-builder__side ui-builder__side--right"
          aria-label="Réglages"
        >
          <Show
            when={current()?.id}
            keyed
            fallback={
              <div class="ui-builder__section">
                <h2>{props.settingsTitle ?? "Réglages"}</h2>
                {props.settings}
              </div>
            }
          >
            {(id) => (
              <>
                <div class="ui-builder__section">
                  <h2>{blockLabel(current() as Block)}</h2>
                  <div class="ui-layer-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="up"
                      iconOnly
                      label="Monter (Alt+↑)"
                      onClick={() => act("up", id)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="down"
                      iconOnly
                      label="Descendre (Alt+↓)"
                      onClick={() => act("down", id)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="copy"
                      iconOnly
                      label="Dupliquer (Ctrl+D)"
                      disabled={current()?.type === "column"}
                      onClick={() => act("duplicate", id)}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="trash"
                      iconOnly
                      label="Supprimer (Suppr)"
                      disabled={current()?.type === "column"}
                      onClick={() => remove(id)}
                    />
                    <Button
                      variant="quiet"
                      size="sm"
                      icon="x"
                      iconOnly
                      label="Désélectionner (Échap)"
                      onClick={() => setSelected(undefined)}
                    />
                  </div>
                </div>
                <div
                  class="ui-builder__tabs"
                  role="tablist"
                  aria-label="Réglages du bloc"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab() === "content"}
                    onClick={() => setTab("content")}
                  >
                    Contenu
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab() === "style"}
                    onClick={() => setTab("style")}
                  >
                    Style
                  </button>
                </div>
                <div class="ui-builder__section" role="tabpanel">
                  <Show when={tab() === "style"}>
                    <p class="ui-builder__device-note">
                      <Icon name={device()} />
                      {device() === "mobile"
                        ? "Mobile uniquement"
                        : "Tous les écrans, sauf réglage mobile"}
                    </p>
                  </Show>
                  <Show
                    when={tab() === "content"}
                    fallback={
                      <>
                        <For
                          each={STYLE_FIELDS.filter((f) =>
                            visible(f, effectiveStyle(), current()?.type ?? ""),
                          )}
                        >
                          {(field) => (
                            <FieldInput
                              field={field}
                              ctx={fieldCtx()}
                              value={style()[field.key]}
                              onChange={(v) =>
                                setStyles(id, { [field.key]: v })
                              }
                            />
                          )}
                        </For>
                        <Show when={device() === "mobile"}>
                          <Button
                            variant="ghost"
                            size="sm"
                            style={{ "margin-top": "1rem" }}
                            onClick={() =>
                              inZoneOf(id, (list) =>
                                updateBlock(list, id, (b) => ({
                                  ...b,
                                  style: { ...(b.style ?? {}), mobile: {} },
                                })),
                              )
                            }
                          >
                            Réinitialiser le mobile
                          </Button>
                        </Show>
                      </>
                    }
                  >
                    <Show when={isFieldBlock(current()?.type ?? "")}>
                      <SelectField
                        label="Type de champ"
                        value={fieldKind(current()?.type ?? "")}
                        options={CONTENT_FIELD_TYPES}
                        onChange={(e) => changeKind(id, e.currentTarget.value)}
                      />
                    </Show>
                    <Show
                      when={blockDef(current()?.type ?? "")?.fields.length}
                      fallback={<p class="ui-muted">Aucun réglage</p>}
                    >
                      <For
                        each={(
                          blockDef(current()?.type ?? "")?.fields ?? []
                        ).filter((f) =>
                          visible(
                            f,
                            current()?.props ?? {},
                            current()?.type ?? "",
                          ),
                        )}
                      >
                        {(field) => (
                          <FieldInput
                            field={field}
                            ctx={fieldCtx()}
                            value={current()?.props[field.key]}
                            onChange={(v) => setProp(id, field.key, v)}
                          />
                        )}
                      </For>
                    </Show>
                  </Show>
                </div>
              </>
            )}
          </Show>
        </aside>
      </div>
      <LinksDatalist id={linksId} links={fieldCtx().links} />
    </div>
  );
}
