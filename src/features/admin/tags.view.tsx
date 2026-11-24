import { createResource } from "solid-js";
import { slugify } from "../render/html";
import type { Tag } from "../site/site.type";
import { Button, LinkButton } from "../ui/button.view";
import { confirmDialog } from "../ui/dialog.view";
import { PageHead } from "../ui/layout.view";
import { Table } from "../ui/table.view";
import { api } from "./client";
import { notify, notifyError } from "./toast";

/** Tags : renommer, changer l'adresse publique, supprimer. */
export function TagsView() {
  const [tags, { refetch }] = createResource(() =>
    api<{ items: Tag[] }>("/api/tags").then((r) => r.items),
  );
  const save = async (tag: Tag, patch: Partial<Tag>) => {
    try {
      await api(`/api/tags/${tag.id}`, { method: "PATCH", body: patch });
      notify("Tag enregistré");
      refetch();
    } catch (e) {
      notifyError(e);
    }
  };
  const remove = async (tag: Tag) => {
    if (
      !(await confirmDialog({
        title: `Supprimer le tag « ${tag.name} » ?`,
        danger: true,
      }))
    )
      return;
    await api(`/api/tags/${tag.id}`, { method: "DELETE" }).catch(notifyError);
    refetch();
  };
  return (
    <>
      <PageHead title="Tags" />
      <Table<Tag>
        caption="Tags"
        rows={tags() ?? []}
        empty="Aucun tag : ajoutez-en depuis un contenu"
        columns={[
          {
            label: "Nom",
            cell: (t) => (
              <input
                class="ui-input ui-input--inline"
                aria-label={`Nom du tag ${t.name}`}
                value={t.name}
                onChange={(e) => save(t, { name: e.currentTarget.value })}
              />
            ),
          },
          {
            label: "Adresse",
            cell: (t) => (
              <span class="ui-permalink" style={{ margin: 0 }}>
                <span aria-hidden="true">/tag/</span>
                <input
                  class="ui-permalink__input"
                  aria-label={`Adresse du tag ${t.name}`}
                  value={t.slug}
                  onChange={(e) =>
                    save(t, { slug: slugify(e.currentTarget.value) })
                  }
                />
              </span>
            ),
          },
          {
            label: "Contenus",
            cell: (t) => (
              <a class="ui-table__link" href={`/admin?tag=${t.id}`}>
                {t.count ?? 0}
              </a>
            ),
          },
          {
            label: "Actions",
            hideLabel: true,
            class: "ui-table__actions",
            cell: (t) => (
              <>
                <LinkButton
                  variant="quiet"
                  size="sm"
                  icon="external"
                  href={`/tag/${t.slug}`}
                  target="_blank"
                  rel="noopener"
                  aria-label={`Voir ${t.name}`}
                />
                <Button
                  variant="quiet"
                  size="sm"
                  icon="trash"
                  iconOnly
                  label={`Supprimer ${t.name}`}
                  onClick={() => remove(t)}
                />
              </>
            ),
          },
        ]}
      />
    </>
  );
}
