import { db } from "~/server/db.server";
import { APP_VERSION } from "~/server/version.server";

/** Santé : base ouverte (migrations jouées) et version en service, pour le lanceur. */
export const GET = () => {
  try {
    db().get("SELECT 1");
    return Response.json(
      { status: "ok", version: APP_VERSION },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error(error);
    return Response.json(
      { status: "error", version: APP_VERSION },
      { status: 503 },
    );
  }
};
