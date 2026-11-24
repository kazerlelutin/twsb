import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type LinkPreview = {
  url: string;
  title: string;
  description: string;
  image: string;
  site: string;
};

export class UnfurlError extends Error {}

const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT = 5000;

/** Adresses internes : jamais interrogées (protection SSRF). */
export function isPrivateAddress(address: string): boolean {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]);
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (isIP(ip) === 6) {
    return (
      ip === "::" ||
      ip === "::1" ||
      ip.startsWith("fc") ||
      ip.startsWith("fd") ||
      ip.startsWith("fe8") ||
      ip.startsWith("fe9") ||
      ip.startsWith("fea") ||
      ip.startsWith("feb") ||
      ip.startsWith("ff")
    );
  }
  return true;
}

async function assertPublic(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new UnfurlError("Adresse non prise en charge.");
  if (url.username || url.password)
    throw new UnfurlError("Adresse non prise en charge.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost"))
    throw new UnfurlError("Adresse interne refusée.");
  const addresses = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true }).catch(() => {
        throw new UnfurlError("Site introuvable.");
      });
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address)))
    throw new UnfurlError("Adresse interne refusée.");
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};
const decode = (value: string) =>
  value
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCodePoint(Number.parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();

/** Extrait titre, description, image et site des balises Open Graph. */
export function parsePreview(html: string, pageUrl: string): LinkPreview {
  const head = html.slice(0, 200_000);
  const meta = new Map<string, string>();
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const attr = (name: string) =>
      tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
    const key = attr("property") ?? attr("name");
    const content = attr("content");
    if (!key || !content) continue;
    const k = (key[2] ?? key[3] ?? "").toLowerCase();
    if (!meta.has(k)) meta.set(k, decode(content[2] ?? content[3] ?? ""));
  }
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const url = new URL(pageUrl);
  let image = meta.get("og:image") ?? meta.get("twitter:image") ?? "";
  try {
    image = image ? new URL(image, url).href : "";
    if (!/^https?:/.test(image)) image = "";
  } catch {
    image = "";
  }
  return {
    url: url.href,
    title: (
      meta.get("og:title") ??
      meta.get("twitter:title") ??
      decode(titleTag?.[1] ?? "") ??
      ""
    ).slice(0, 200),
    description: (
      meta.get("og:description") ??
      meta.get("twitter:description") ??
      meta.get("description") ??
      ""
    ).slice(0, 300),
    image: image.slice(0, 1000),
    site: (
      meta.get("og:site_name") ?? url.hostname.replace(/^www\./, "")
    ).slice(0, 80),
  };
}

async function readLimited(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => undefined);
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, MAX_BYTES));
}

const cache = new Map<string, LinkPreview>();

/** Aperçu d'une page publique : redirections suivies et revérifiées, taille et durée bornées. */
export async function unfurl(raw: string): Promise<LinkPreview> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnfurlError("Adresse invalide.");
  }
  const cached = cache.get(url.href);
  if (cached) return cached;
  const fallback: LinkPreview = {
    url: url.href,
    title: "",
    description: "",
    image: "",
    site: url.hostname.replace(/^www\./, ""),
  };
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(current);
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT),
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "Mozilla/5.0 (compatible; TWSB link preview)",
      },
    }).catch(() => {
      throw new UnfurlError("Site injoignable.");
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(location, current);
      continue;
    }
    const type = response.headers.get("content-type") ?? "";
    const preview =
      response.ok && type.includes("html")
        ? {
            ...parsePreview(await readLimited(response), current.href),
            url: url.href,
          }
        : fallback;
    if (cache.size > 300) cache.delete(cache.keys().next().value as string);
    cache.set(url.href, preview);
    return preview;
  }
  return fallback;
}
