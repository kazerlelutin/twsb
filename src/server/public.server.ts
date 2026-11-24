import { iconPng, readMediaFile } from "./media.server";
import { getIdentity } from "./repo.server";
import { ensureAdmin } from "./seed.server";
import { renderPublic, robots, sitemap } from "./site.server";
import { countUsers } from "./users.server";

const APP_PREFIXES = [
  "/admin",
  "/api",
  "/_build",
  "/_server",
  "/node_modules",
  "/src",
  "/healthz",
  "/fonts",
  "/twsb.svg",
  "/twsb-mark.svg",
];
const isApp = (pathname: string) =>
  pathname.startsWith("/@") ||
  pathname.startsWith("/__") ||
  APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

const html = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
    },
  });

/** Sert le site public, les médias et les fichiers SEO ; sinon laisse passer. */
export async function publicResponse(
  request: Request,
): Promise<Response | undefined> {
  if (request.method !== "GET" && request.method !== "HEAD") return undefined;
  const { pathname } = new URL(request.url);
  if (isApp(pathname)) return undefined;

  const asset = await assetResponse(request);
  if (asset) return asset;
  if (pathname === "/sitemap.xml")
    return new Response(sitemap(), {
      headers: { "content-type": "application/xml; charset=utf-8" },
    });
  if (pathname === "/robots.txt")
    return new Response(robots(), {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  if (/\.[a-z0-9]{1,5}$/i.test(pathname)) return undefined;

  // Site pas encore installé (aucun compte) : on va d'abord à l'installation.
  if (!(await installed()))
    return new Response(null, {
      status: 302,
      headers: { location: "/admin/setup", "cache-control": "no-store" },
    });

  const page = renderPublic(pathname);
  if (page.location)
    return new Response(null, {
      status: 301,
      headers: { location: page.location },
    });
  return html(page.html, page.status);
}

let isInstalled = false;
/** Un compte existe (créé à l'installation ou depuis ADMIN_EMAIL / ADMIN_PASSWORD). */
export async function installed() {
  if (isInstalled) return true;
  await ensureAdmin();
  isInstalled = countUsers() > 0;
  return isInstalled;
}
/** Tests : un nouveau site repart non installé. */
export const resetInstalled = () => {
  isInstalled = false;
};

/** Médias et icônes : servis aussi par une route Nitro dédiée (voir vite.config.ts). */
export async function assetResponse(
  request: Request,
): Promise<Response | undefined> {
  const { pathname } = new URL(request.url);
  if (pathname.startsWith("/media/")) {
    const [, , id, file] = pathname.split("/");
    const found = id && file ? await readMediaFile(id, file) : undefined;
    if (!found) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(found.data), {
      headers: {
        "content-type": found.type,
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
        ...(found.type === "image/svg+xml"
          ? {
              "content-security-policy":
                "default-src 'none'; style-src 'unsafe-inline'",
            }
          : {}),
      },
    });
  }
  if (
    pathname === "/favicon.png" ||
    pathname === "/apple-touch-icon.png" ||
    pathname === "/favicon.ico"
  ) {
    const id = getIdentity().faviconId;
    const png = id
      ? await iconPng(id, pathname === "/apple-touch-icon.png" ? 180 : 32)
      : undefined;
    if (!png) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(png), {
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=3600",
      },
    });
  }
  return undefined;
}
