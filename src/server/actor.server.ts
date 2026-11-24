import { AsyncLocalStorage } from "node:async_hooks";

/** Contexte d'une requête : auteur des modifications et nature de l'action. */
export type Actor = { userId?: string; restoring?: boolean };

const storage = new AsyncLocalStorage<Actor>();

export const withActor = <T>(fn: () => T) => storage.run({}, fn);
export const actor = (): Actor => storage.getStore() ?? {};
export const setActor = (patch: Actor) => {
  const store = storage.getStore();
  if (store) Object.assign(store, patch);
};
