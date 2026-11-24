import { slugify } from "../render/html";
import type { ContentField } from "../site/site.type";
import type { Block } from "./block.type";
import { fieldKind, isFieldBlock } from "./catalog";

/** Clés réservées aux propriétés natives d'un contenu. */
export const RESERVED_KEYS = new Set([
  "title",
  "slug",
  "body",
  "excerpt",
  "tags",
  "cover",
]);

const keyOf = (label: string) => slugify(label).replaceAll("-", "_");

/**
 * Les champs se déduisent des blocs-champs posés dans des blocs :
 * clé stable (fixée au premier enregistrement, unique), nom, saisie, obligation, choix.
 */
export function deriveFields(blocks: Block[]): {
  blocks: Block[];
  fields: ContentField[];
} {
  const seen = new Set<string>();
  const fields: ContentField[] = [];
  const visit = (list: Block[]): Block[] =>
    list.map((block) => {
      let next = block;
      if (isFieldBlock(block.type)) {
        const props = block.props ?? {};
        const label =
          String(props.label ?? "")
            .trim()
            .slice(0, 80) || "Champ";
        const base =
          String(props.key || keyOf(label))
            .replace(/[^a-z0-9_]/g, "")
            .slice(0, 40) || "champ";
        let key = RESERVED_KEYS.has(base) ? `${base}_2` : base;
        for (let i = 2; seen.has(key); i++) key = `${base}_${i}`;
        seen.add(key);
        const kind = fieldKind(block.type);
        const field: ContentField = { key, label, type: kind };
        if (props.required === true) field.required = true;
        if (kind === "select") {
          field.options = String(props.options ?? "")
            .split(/[,\n]/)
            .map((o) => o.trim())
            .filter(Boolean)
            .slice(0, 50);
        }
        fields.push(field);
        next = { ...block, props: { ...props, key, label } };
      }
      return next.children ? { ...next, children: visit(next.children) } : next;
    });
  return { blocks: visit(blocks), fields };
}

/** Champs d'un contenu : ceux du type, puis ceux ajoutés dans le contenu lui-même. */
export function mergeFields(
  typeFields: ContentField[],
  contentFields: ContentField[],
): ContentField[] {
  const keys = new Set(typeFields.map((f) => f.key));
  return [...typeFields, ...contentFields.filter((f) => !keys.has(f.key))];
}
