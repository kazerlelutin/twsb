export { compareVersions } from "../../launcher/core.mjs";

/** Version en cours d'exécution (package.json au moment du build). */
export const APP_VERSION: string =
  typeof __TWSB_VERSION__ === "string" ? __TWSB_VERSION__ : "0.0.0-dev";
