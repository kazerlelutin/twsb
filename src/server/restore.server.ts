import type {
  Content,
  ContentType,
  Identity,
  Layout,
  MediaInfo,
  Menu,
  Plugins,
} from "../features/site/site.type";
import { setActor } from "./actor.server";
import { db } from "./db.server";
import {
  getContent,
  getMedia,
  getType,
  restoreTag,
  saveContent,
  saveIdentity,
  saveLayout,
  saveMenu,
  savePlugins,
  saveType,
  uniqueSlug,
  updateMedia,
} from "./repo.server";
import { getRevision, type RevisionEntity } from "./revisions.server";

export class RestoreError extends Error {}

/** Restaurer un type, un layout, l'identité ou les extensions est réservé aux administrateurs. */
export const ADMIN_ENTITIES = new Set<RevisionEntity>([
  "type",
  "layout",
  "identity",
  "plugins",
]);

/**
 * Remet un élément dans l'état d'une révision. La restauration est elle-même
 * enregistrée comme une nouvelle révision : rien n'est perdu.
 */
export function restoreRevision(id: string) {
  const revision = getRevision(id);
  if (!revision) throw new RestoreError("Révision introuvable.");
  const data = revision.data;
  setActor({ restoring: true });
  try {
    return db().tx(() => {
      switch (revision.entity) {
        case "content": {
          const c = data as unknown as Content;
          if (!getType(c.typeId))
            throw new RestoreError("Restaurez d'abord son type de contenu.");
          const exists = !!getContent(c.id);
          saveContent(c.id, {
            typeId: c.typeId,
            title: c.title,
            slug: exists
              ? c.slug
              : uniqueSlug(c.typeId, c.slug, c.id, c.lang ?? ""),
            status: c.status,
            excerpt: c.excerpt,
            body: c.body,
            blocks: c.blocks,
            data: c.data,
            coverId: c.coverId && getMedia(c.coverId) ? c.coverId : null,
            lang: c.lang ?? "",
            translationOf:
              c.translationOf && getContent(c.translationOf)
                ? c.translationOf
                : null,
            publishedAt: c.publishedAt,
            tags: (c.tags ?? []).map((t) => t.name),
          });
          break;
        }
        case "type": {
          const { contentCount: _count, ...type } =
            data as unknown as ContentType;
          saveType(type);
          break;
        }
        case "layout": {
          const layout = data as unknown as Layout;
          saveLayout(layout, layout.id);
          break;
        }
        case "menu":
          saveMenu(data as unknown as Menu);
          break;
        case "tag":
          restoreTag(
            data as {
              id: string;
              name: string;
              slug: string;
              contentIds?: string[];
            },
          );
          break;
        case "media": {
          const media = data as unknown as MediaInfo;
          // Les fichiers d'un média supprimé n'existent plus : seules ses infos se restaurent.
          if (!getMedia(media.id))
            throw new RestoreError(
              "Les fichiers de ce média ont été supprimés : renvoyez-le.",
            );
          updateMedia(media.id, { name: media.name, alt: media.alt });
          break;
        }
        case "identity":
          saveIdentity(data as unknown as Identity);
          break;
        case "plugins":
          savePlugins(data as unknown as Plugins);
          break;
      }
      return { entity: revision.entity, entityId: revision.entityId };
    });
  } finally {
    setActor({ restoring: false });
  }
}
