import { RESERVED_KEYS } from "../features/blocks/fields";
import { safeUrl, slugify } from "../features/render/html";
import {
  CONTENT_FIELD_TYPES,
  type ContentField,
} from "../features/site/site.type";
import { sanitizeRich } from "./sanitize.server";

const TYPES = new Set(CONTENT_FIELD_TYPES.map((t) => t.value));

/** Normalise la définition des champs d'un type : clés uniques, types connus. */
export function cleanFieldDefs(raw: unknown): ContentField[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ContentField[] = [];
  for (const item of raw.slice(0, 60)) {
    if (!item || typeof item !== "object") continue;
    const f = item as Record<string, unknown>;
    const label = String(f.label ?? "")
      .trim()
      .slice(0, 80);
    const type = String(f.type ?? "text");
    if (!label || !TYPES.has(type as ContentField["type"])) continue;
    let key =
      slugify(String(f.key || label))
        .replaceAll("-", "_")
        .slice(0, 40) || "champ";
    if (RESERVED_KEYS.has(key)) key = `${key}_2`;
    for (let i = 2; seen.has(key); i++)
      key = `${key.replace(/_\d+$/, "")}_${i}`;
    seen.add(key);
    const field: ContentField = {
      key,
      label,
      type: type as ContentField["type"],
    };
    if (f.required === true) field.required = true;
    if (type === "select") {
      field.options = (Array.isArray(f.options) ? f.options : [])
        .map((o) => String(o).trim().slice(0, 80))
        .filter(Boolean)
        .slice(0, 50);
    }
    out.push(field);
  }
  return out;
}

/** Valide les valeurs saisies selon les champs du type ; ignore les clés inconnues. */
export function cleanData(
  fields: ContentField[],
  raw: unknown,
): { data: Record<string, unknown>; missing: string[] } {
  const input =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const data: Record<string, unknown> = {};
  const missing: string[] = [];
  for (const field of fields) {
    const value = input[field.key];
    let clean: unknown;
    switch (field.type) {
      case "richtext":
        clean = typeof value === "string" ? sanitizeRich(value) : "";
        break;
      case "textarea":
        // Saisi dans l'éditeur en paragraphes ; l'ancien texte brut reste accepté.
        clean =
          typeof value === "string"
            ? (value.trimStart().startsWith("<")
                ? sanitizeRich(value)
                : value
              ).slice(0, 50_000)
            : "";
        break;
      case "number":
        clean =
          value === "" ||
          value === null ||
          value === undefined ||
          Number.isNaN(Number(value))
            ? null
            : Number(value);
        break;
      case "toggle":
        clean = value === true;
        break;
      case "date":
        clean =
          typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
            ? value
            : "";
        break;
      case "select":
        clean =
          typeof value === "string" && field.options?.includes(value)
            ? value
            : "";
        break;
      case "gallery":
        clean = Array.isArray(value)
          ? value
              .filter((v) => typeof v === "string" && /^[\w-]{1,64}$/.test(v))
              .slice(0, 100)
          : [];
        break;
      case "media":
        clean =
          typeof value === "string" && /^[\w-]{0,64}$/.test(value) ? value : "";
        break;
      case "url":
        clean = safeUrl(value);
        break;
      case "email":
        clean =
          typeof value === "string" &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
            ? value.trim()
            : "";
        break;
      case "color":
        clean =
          typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value)
            ? value
            : "";
        break;
      default:
        clean = typeof value === "string" ? value.slice(0, 500) : "";
    }
    const empty =
      clean === "" || clean === null || (Array.isArray(clean) && !clean.length);
    if (field.required && empty) missing.push(field.label);
    data[field.key] = clean;
  }
  return { data, missing };
}
