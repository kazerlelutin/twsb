import { defineHandler } from "nitro/h3";
import { assetResponse } from "./public.server";

/**
 * En dev, Nitro confie à Vite toute URL qui ressemble à un fichier (.webp, .png…)
 * sauf si une route explicite existe : ce handler la déclare pour les médias.
 */
export default defineHandler(
  async (event) =>
    (await assetResponse(event.req)) ??
    new Response("Not found", { status: 404 }),
);
