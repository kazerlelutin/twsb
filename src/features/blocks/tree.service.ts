import type { Block } from "./block.type";
import { blockDef, cloneBlock, syncColumns } from "./catalog";

export type Located = {
  block: Block;
  parent?: Block;
  index: number;
  siblings: Block[];
};

export function locate(
  blocks: Block[],
  id: string,
  parent?: Block,
): Located | undefined {
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    if (block.id === id) return { block, parent, index, siblings: blocks };
    if (block.children) {
      const found = locate(block.children, id, block);
      if (found) return found;
    }
  }
  return undefined;
}

const mapTree = (blocks: Block[], fn: (b: Block) => Block | null): Block[] =>
  blocks.flatMap((block) => {
    const next = fn(block);
    if (!next) return [];
    return [
      next.children ? { ...next, children: mapTree(next.children, fn) } : next,
    ];
  });

export function updateBlock(
  blocks: Block[],
  id: string,
  patch: (b: Block) => Block,
): Block[] {
  return mapTree(blocks, (b) => (b.id === id ? syncColumns(patch(b)) : b));
}

export function removeBlock(blocks: Block[], id: string): Block[] {
  return mapTree(blocks, (b) => (b.id === id ? null : b));
}

/** Insère après la cible, dans la cible si c'est un conteneur, ou à la fin. */
export function insertBlock(
  blocks: Block[],
  block: Block,
  targetId?: string,
): Block[] {
  if (!targetId) return [...blocks, block];
  const target = locate(blocks, targetId);
  if (!target) return [...blocks, block];
  const def = blockDef(target.block.type);
  if (def?.container && (!def.childType || def.childType === block.type)) {
    return updateBlock(blocks, targetId, (b) => ({
      ...b,
      children: [...(b.children ?? []), block],
    }));
  }
  if (def?.childType) {
    // Colonnes : on ajoute dans la première colonne.
    const first = target.block.children?.[0];
    if (first) return insertBlock(blocks, block, first.id);
  }
  return insertSibling(blocks, targetId, block);
}

function insertSibling(
  blocks: Block[],
  targetId: string,
  block: Block,
): Block[] {
  const index = blocks.findIndex((b) => b.id === targetId);
  if (index >= 0)
    return [...blocks.slice(0, index + 1), block, ...blocks.slice(index + 1)];
  return blocks.map((b) =>
    b.children
      ? { ...b, children: insertSibling(b.children, targetId, block) }
      : b,
  );
}

export function moveBlock(blocks: Block[], id: string, delta: -1 | 1): Block[] {
  const index = blocks.findIndex((b) => b.id === id);
  if (index >= 0) {
    const next = index + delta;
    if (next < 0 || next >= blocks.length) return blocks;
    const copy = [...blocks];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    return copy;
  }
  return blocks.map((b) =>
    b.children ? { ...b, children: moveBlock(b.children, id, delta) } : b,
  );
}

export function duplicateBlock(blocks: Block[], id: string): Block[] {
  const found = locate(blocks, id);
  if (!found || found.block.type === "column") return blocks;
  return insertSibling(blocks, id, cloneBlock(found.block));
}

/** Déplace un bloc vers une autre position (glisser-déposer). */
export type Position = "before" | "after" | "inside";

/** Ramène une cible de dépôt à une position valide (colonnes, conteneurs). */
function normalizeTarget(
  blocks: Block[],
  block: Block,
  targetId: string,
  position: Position,
): { id: string; position: Position } | undefined {
  const target = locate(blocks, targetId);
  if (!target) return undefined;
  const def = blockDef(target.block.type);
  if (position === "inside") {
    if (def?.childType) {
      const first = target.block.children?.[0];
      return def.childType === block.type || !first
        ? undefined
        : { id: first.id, position: "inside" };
    }
    if (!def?.container) return { id: targetId, position: "after" };
    return { id: targetId, position };
  }
  // Une colonne n'a pas de voisins libres : on dépose dedans.
  if (target.block.type === "column" && block.type !== "column")
    return { id: targetId, position: "inside" };
  return { id: targetId, position };
}

/** Place un bloc avant, après ou dans une cible ; renvoie l'arbre inchangé si impossible. */
export function placeBlock(
  blocks: Block[],
  block: Block,
  targetId: string,
  position: Position,
): Block[] {
  const target = normalizeTarget(blocks, block, targetId, position);
  if (!target) return blocks;
  if (target.position === "inside") {
    return updateBlock(blocks, target.id, (b) => ({
      ...b,
      children: [...(b.children ?? []), block],
    }));
  }
  const place = (list: Block[]): Block[] => {
    const index = list.findIndex((b) => b.id === target.id);
    if (index >= 0) {
      const at = target.position === "before" ? index : index + 1;
      return [...list.slice(0, at), block, ...list.slice(at)];
    }
    return list.map((b) =>
      b.children ? { ...b, children: place(b.children) } : b,
    );
  };
  return place(blocks);
}

/** Déplace un bloc vers une autre position (glisser-déposer). */
export function relocate(
  blocks: Block[],
  id: string,
  targetId: string,
  position: Position,
): Block[] {
  if (id === targetId) return blocks;
  const source = locate(blocks, id);
  if (!source || source.block.type === "column") return blocks;
  if (locate([source.block], targetId)) return blocks;
  const without = removeBlock(blocks, id);
  const next = placeBlock(without, source.block, targetId, position);
  return next === without ? blocks : next;
}

export type Zones = Record<string, Block[]>;
export type DropTarget = { id?: string; zone?: string; position: Position };

export const zoneOf = (zones: Zones, id: string) =>
  Object.keys(zones).find((z) => locate(zones[z] ?? [], id));

/** Insère un bloc dans une zone : relativement à une cible, ou à la fin. */
export function insertInZones(
  zones: Zones,
  block: Block,
  target: DropTarget,
  fallbackZone: string,
): Zones {
  const zone =
    (target.id && zoneOf(zones, target.id)) || target.zone || fallbackZone;
  const list = zones[zone] ?? [];
  const next = target.id
    ? placeBlock(list, block, target.id, target.position)
    : [...list, block];
  return next === list ? zones : { ...zones, [zone]: next };
}

/** Déplace un bloc, y compris d'une zone à l'autre (en-tête vers pied). */
export function moveInZones(
  zones: Zones,
  id: string,
  target: DropTarget,
): Zones {
  const from = zoneOf(zones, id);
  if (!from || id === target.id) return zones;
  const source = locate(zones[from], id);
  if (!source || source.block.type === "column") return zones;
  if (target.id && locate([source.block], target.id)) return zones;
  const removed = { ...zones, [from]: removeBlock(zones[from], id) };
  const next = insertInZones(removed, source.block, target, from);
  return next === removed ? zones : next;
}

export function walk(blocks: Block[], fn: (b: Block) => void) {
  for (const block of blocks) {
    fn(block);
    if (block.children) walk(block.children, fn);
  }
}
