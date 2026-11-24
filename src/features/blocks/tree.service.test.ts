import { describe, expect, test } from "vitest";
import type { Block } from "./block.type";
import { createBlock, syncColumns } from "./catalog";
import {
  duplicateBlock,
  insertBlock,
  insertInZones,
  locate,
  moveBlock,
  moveInZones,
  placeBlock,
  relocate,
  removeBlock,
  updateBlock,
} from "./tree.service";

const heading = (id: string): Block => ({
  id,
  type: "heading",
  props: { text: id },
});

describe("arbre de blocs", () => {
  test("insère dans un conteneur sélectionné", () => {
    const section: Block = {
      id: "s",
      type: "section",
      props: {},
      children: [],
    };
    const next = insertBlock([section], heading("h"), "s");
    expect(next[0].children?.[0].id).toBe("h");
  });

  test("insère après un bloc simple", () => {
    const next = insertBlock([heading("a"), heading("c")], heading("b"), "a");
    expect(next.map((b) => b.id)).toEqual(["a", "b", "c"]);
  });

  test("insère dans la première colonne d'une grille", () => {
    const cols = createBlock("columns");
    const next = insertBlock([cols], heading("h"), cols.id);
    expect(next[0].children?.[0].children?.[0].id).toBe("h");
  });

  test("déplace, duplique et supprime", () => {
    const list = [heading("a"), heading("b")];
    expect(moveBlock(list, "b", -1).map((b) => b.id)).toEqual(["b", "a"]);
    expect(moveBlock(list, "a", -1)).toBe(list);
    const dup = duplicateBlock(list, "a");
    expect(dup).toHaveLength(3);
    expect(dup[1].id).not.toBe("a");
    expect(removeBlock(list, "a").map((b) => b.id)).toEqual(["b"]);
  });

  test("met à jour un bloc imbriqué", () => {
    const section: Block = {
      id: "s",
      type: "section",
      props: {},
      children: [heading("h")],
    };
    const next = updateBlock([section], "h", (b) => ({
      ...b,
      props: { text: "ok" },
    }));
    expect(locate(next, "h")?.block.props.text).toBe("ok");
  });

  test("synchronise les colonnes sans perdre de contenu", () => {
    const cols = createBlock("columns");
    cols.children?.[1].children?.push(heading("x"));
    const single = syncColumns({
      ...cols,
      props: { ...cols.props, ratio: "1" },
    });
    expect(single.children).toHaveLength(1);
    expect(single.children?.[0].children?.[0].id).toBe("x");
    const three = syncColumns({
      ...cols,
      props: { ...cols.props, ratio: "1-1-1" },
    });
    expect(three.children).toHaveLength(3);
  });

  test("glisse un bloc avant un autre sans pouvoir le placer en lui-même", () => {
    const section: Block = {
      id: "s",
      type: "section",
      props: {},
      children: [heading("h")],
    };
    const next = relocate([section, heading("a")], "a", "h", "before");
    expect(next[0].children?.map((b) => b.id)).toEqual(["a", "h"]);
    expect(relocate([section], "s", "h", "inside")).toEqual([section]);
  });
});

describe("déplacements entre zones", () => {
  const h = (id: string): Block => ({ id, type: "heading", props: {} });

  test("déplace un bloc de l'en-tête vers le pied", () => {
    const zones = { header: [h("a")], footer: [h("b")] };
    const next = moveInZones(zones, "a", { id: "b", position: "after" });
    expect(next.header).toEqual([]);
    expect(next.footer.map((b) => b.id)).toEqual(["b", "a"]);
  });

  test("dépose à la fin d'une zone vide", () => {
    const zones = { header: [h("a")], footer: [] };
    const next = moveInZones(zones, "a", {
      zone: "footer",
      position: "inside",
    });
    expect(next.footer.map((b) => b.id)).toEqual(["a"]);
  });

  test("déposer à côté d'une colonne revient à déposer dedans", () => {
    const cols = createBlock("columns");
    const col = cols.children?.[0] as Block;
    const next = placeBlock([cols], h("x"), col.id, "before");
    expect(next[0].children?.[0].children?.[0].id).toBe("x");
  });

  test("un bloc simple ne peut pas recevoir d'enfant", () => {
    const next = placeBlock([h("a")], h("x"), "a", "inside");
    expect(next.map((b) => b.id)).toEqual(["a", "x"]);
  });

  test("insère un nouveau bloc dans la zone de la cible", () => {
    const zones = { header: [h("a")], footer: [h("b")] };
    const next = insertInZones(
      zones,
      h("n"),
      { id: "b", position: "before" },
      "header",
    );
    expect(next.footer.map((b) => b.id)).toEqual(["n", "b"]);
  });
});
