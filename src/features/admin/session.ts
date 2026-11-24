import { createResource, createRoot } from "solid-js";
import { api, type User } from "./client";

/** Session partagée par toutes les pages d'administration. */
export const session = createRoot(() => {
  const [user, { refetch, mutate }] = createResource(async () => {
    const { user } = await api<{ user: User | null }>("/api/auth/me");
    return user;
  });
  return { user, refetch, mutate };
});

export async function logout() {
  await api("/api/auth/logout", { method: "POST" });
  session.mutate(null);
  window.location.href = "/admin/login";
}
