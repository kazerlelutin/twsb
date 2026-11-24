import { createResource, createSignal, For, Show } from "solid-js";
import type {
  RevisionEntity,
  RevisionSummary,
} from "~/server/revisions.server";
import { Button } from "../ui/button.view";
import { confirmDialog } from "../ui/dialog.view";
import { Badge } from "../ui/layout.view";
import { Modal } from "../ui/modal.view";
import { api } from "./client";
import { notify, notifyError } from "./toast";

export const ACTION_LABELS: Record<RevisionSummary["action"], string> = {
  create: "Création",
  update: "Modification",
  delete: "Suppression",
  restore: "Restauration",
};

export const ENTITY_LABELS: Record<RevisionEntity, string> = {
  content: "Contenu",
  type: "Type",
  layout: "Layout",
  menu: "Menu",
  tag: "Tag",
  media: "Média",
  identity: "Identité",
  plugins: "Extensions",
};

/** Date et heure : plusieurs révisions peuvent dater du même jour. */
export const formatDateTime = (value: number) =>
  new Date(value).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export async function restore(revision: RevisionSummary) {
  const ok = await confirmDialog({
    title: `Restaurer « ${revision.label || ENTITY_LABELS[revision.entity]} » ?`,
    message: `État du ${formatDateTime(revision.createdAt)}. L'état actuel reste dans l'historique.`,
    confirmLabel: "Restaurer",
  });
  if (!ok) return false;
  try {
    await api(`/api/revisions/${revision.id}/restore`, { method: "POST" });
    notify("Restauré");
    return true;
  } catch (e) {
    notifyError(e);
    return false;
  }
}

/** Historique d'un élément : chaque version peut être restaurée. */
export function HistoryButton(props: {
  entity: RevisionEntity;
  id: string;
  /** Après restauration ; par défaut, la page est rechargée. */
  onRestored?: () => void;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = createSignal(false);
  const [items, { refetch }] = createResource(
    () => (open() ? props.id : undefined),
    (id) =>
      api<{ items: RevisionSummary[] }>(
        `/api/revisions?entity=${props.entity}&id=${encodeURIComponent(id)}`,
      ).then((r) => r.items),
  );
  const pick = async (revision: RevisionSummary) => {
    if (!(await restore(revision))) return;
    setOpen(false);
    if (props.onRestored) props.onRestored();
    else window.location.reload();
  };
  return (
    <>
      <Button
        variant="quiet"
        size={props.size}
        icon="history"
        iconOnly
        label="Historique"
        onClick={() => {
          setOpen(true);
          refetch();
        }}
      />
      <Modal open={open()} title="Historique" onClose={() => setOpen(false)}>
        <Show
          when={items()?.length}
          fallback={<p class="ui-muted">Aucune révision</p>}
        >
          <ol class="ui-history">
            <For each={items()}>
              {(revision, i) => (
                <li class="ui-history__item">
                  <div class="ui-history__main">
                    <span class="ui-history__label">
                      {revision.label || ENTITY_LABELS[revision.entity]}
                    </span>
                    <span class="ui-muted">
                      {formatDateTime(revision.createdAt)}
                      {revision.userName ? ` | ${revision.userName}` : ""}
                    </span>
                  </div>
                  <Badge tone={i() === 0 ? "accent" : "neutral"}>
                    {i() === 0 ? "Actuelle" : ACTION_LABELS[revision.action]}
                  </Badge>
                  <Show when={i() > 0}>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="undo"
                      onClick={() => pick(revision)}
                      aria-label={`Restaurer la version du ${formatDateTime(revision.createdAt)}`}
                    >
                      Restaurer
                    </Button>
                  </Show>
                </li>
              )}
            </For>
          </ol>
        </Show>
      </Modal>
    </>
  );
}
