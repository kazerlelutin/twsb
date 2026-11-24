import { type output, ZodError, type ZodTypeAny } from "zod";
import "./seed.server";
import { ensureAdmin } from "./seed.server";
import { type Role, type User, userBySession } from "./users.server";

export const SESSION_COOKIE = "ws_session";

export type ApiEvent = { request: Request; params: Record<string, string> };

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const json = (
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });

export function cookie(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

const secure = (request: Request) =>
  new URL(request.url).protocol === "https:" ||
  request.headers.get("x-forwarded-proto") === "https";

export const sessionCookie = (
  request: Request,
  token: string,
  maxAge: number,
) =>
  `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure(request) ? "; Secure" : ""}`;

export const clearSessionCookie = (request: Request) =>
  sessionCookie(request, "", 0);

export async function currentUser(request: Request): Promise<User | undefined> {
  await ensureAdmin();
  return userBySession(cookie(request, SESSION_COOKIE));
}

/** Les requêtes d'écriture doivent venir de la même origine (anti-CSRF). */
export function checkOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host || new URL(origin).host !== host)
    throw new HttpError(403, "Origine refusée.");
}

export async function requireUser(request: Request, role?: Role) {
  checkOrigin(request);
  const user = await currentUser(request);
  if (!user) throw new HttpError(401, "Connexion requise.");
  if (role === "admin" && user.role !== "admin")
    throw new HttpError(403, "Réservé aux administrateurs.");
  return user;
}

export async function body<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<output<S>> {
  let data: unknown;
  try {
    data = await request.json();
  } catch {
    throw new HttpError(400, "Corps JSON invalide.");
  }
  return schema.parse(data);
}

type Handler = (event: ApiEvent) => Promise<Response> | Response;

/** Uniformise les erreurs des routes d'API. */
export const api =
  (fn: Handler): Handler =>
  async (event) => {
    try {
      return await fn(event);
    } catch (error) {
      if (error instanceof HttpError)
        return json({ error: error.message }, error.status);
      if (error instanceof ZodError) {
        return json(
          {
            error: "Données invalides.",
            issues: error.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            })),
          },
          422,
        );
      }
      if (error instanceof Error && /UNIQUE constraint/.test(error.message))
        return json({ error: "Cette valeur existe déjà." }, 409);
      console.error(error);
      return json({ error: "Erreur serveur." }, 500);
    }
  };

export const query = (request: Request) => new URL(request.url).searchParams;
