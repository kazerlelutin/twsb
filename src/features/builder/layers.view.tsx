import { createSignal, For, Show } from "solid-js";
import type { Block } from "../blocks/block.type";
import { blockDef } from "../blocks/catalog";

type Drop = { id: string; position: "before" | "after" | "inside" } | null;

export const blockLabel = (block: Block) => {
  const def = blockDef(block.type);
  const p = block.props ?? {};
  const text = [p.text, p.title, p.label].find(
    (v) => typeof v === "string" && v.trim(),
  );
  return text
    ? `${def?.label ?? block.type} | ${String(text).slice(0, 28)}`
    : (def?.label ?? block.type);
};

// Partagés entre les arbres de chaque zone : on peut glisser de l'en-tête au pied.
const [drag, setDrag] = createSignal<string | null>(null);
const [drop, setDrop] = createSignal<Drop>(null);

/** Arborescence des blocs : sélection et glisser-déposer. */
export function Layers(props: {
  blocks: Block[];
  selected?: string;
  onSelect: (id: string) => void;
  onMove: (
    id: string,
    targetId: string,
    position: "before" | "after" | "inside",
  ) => void;
}) {
  const Item = (p: { block: Block }) => {
    const def = blockDef(p.block.type);
    const zone = (e: DragEvent): Drop => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const y = (e.clientY - rect.top) / rect.height;
      if (def?.container && y > 0.3 && y < 0.7)
        return { id: p.block.id, position: "inside" };
      return { id: p.block.id, position: y < 0.5 ? "before" : "after" };
    };
    return (
      <li>
        <button
          type="button"
          class="ui-layer"
          classList={{
            "ui-layer--drop-before":
              drop()?.id === p.block.id && drop()?.position === "before",
            "ui-layer--drop-after":
              drop()?.id === p.block.id && drop()?.position === "after",
            "ui-layer--drop-inside":
              drop()?.id === p.block.id && drop()?.position === "inside",
          }}
          aria-current={props.selected === p.block.id ? "true" : undefined}
          draggable={p.block.type !== "column"}
          onClick={() => props.onSelect(p.block.id)}
          onDragStart={(e) => {
            setDrag(p.block.id);
            e.dataTransfer?.setData("text/plain", p.block.id);
          }}
          onDragOver={(e) => {
            if (!drag() || drag() === p.block.id) return;
            e.preventDefault();
            setDrop(zone(e));
          }}
          onDragLeave={() => setDrop(null)}
          onDrop={(e) => {
            e.preventDefault();
            const target = drop();
            const source = drag();
            setDrop(null);
            setDrag(null);
            if (source && target)
              props.onMove(source, target.id, target.position);
          }}
          onDragEnd={() => {
            setDrag(null);
            setDrop(null);
          }}
        >
          <span class="ui-layer__icon" aria-hidden="true">
            {def?.icon}
          </span>
          <span class="ui-layer__label">{blockLabel(p.block)}</span>
        </button>
        <Show when={p.block.children?.length}>
          <ul>
            <For each={p.block.children}>
              {(child) => <Item block={child} />}
            </For>
          </ul>
        </Show>
      </li>
    );
  };

  return (
    <ul class="ui-layers" aria-label="Structure">
      <For each={props.blocks}>{(block) => <Item block={block} />}</For>
    </ul>
  );
}
