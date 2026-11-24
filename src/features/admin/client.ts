import type { User } from "~/server/users.server";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; form?: FormData } = {},
): Promise<T> {
  const init: RequestInit = {
    method: options.method ?? (options.body || options.form ? "POST" : "GET"),
    credentials: "same-origin",
  };
  if (options.form) init.body = options.form;
  else if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
    init.headers = { "content-type": "application/json" };
  }
  const response = await fetch(path, init);
  const type = response.headers.get("content-type") ?? "";
  const data = type.includes("json")
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/api/auth")) {
      window.location.href = `/admin/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new ApiError(
      response.status,
      (data as { error?: string })?.error ?? "Erreur inattendue.",
    );
  }
  return data as T;
}

export const qs = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== "") search.set(k, String(v));
  const s = search.toString();
  return s ? `?${s}` : "";
};

export type { User };

export const formatDate = (value: number | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

export const formatSize = (bytes: number) =>
  bytes > 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} Mo`
    : `${Math.max(1, Math.round(bytes / 1000))} ko`;
