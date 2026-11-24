const ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export const esc = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

export const str = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;
export const num = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
export const bool = (value: unknown) =>
  value === true || value === "true" || value === 1;

/** Refuse javascript:, data: et autres schémas risqués. */
export function safeUrl(value: unknown): string {
  const url = str(value).trim();
  if (!url) return "";
  if (/^(https?:|mailto:|tel:)/i.test(url)) return url;
  if (/^[/\\]{2}|^\/\\/.test(url)) return "";
  if (/^[/#?]/.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return "";
  return `/${url}`;
}

export const isColor = (value: unknown) =>
  typeof value === "string" &&
  /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|transparent|var\(--ws-[a-z-]+\))$/i.test(
    value.trim(),
  );

export const color = (value: unknown) =>
  isColor(value) ? String(value).trim() : "";

export const attrs = (
  record: Record<string, string | number | boolean | undefined | null>,
) =>
  Object.entries(record)
    .filter(([, v]) => v !== undefined && v !== null && v !== false && v !== "")
    .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${esc(v)}"`))
    .join("");

export const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
