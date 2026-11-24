import { useNavigate, useSearchParams } from "@solidjs/router";
import { createResource, For, Show } from "solid-js";
import type { ContentSummary, ContentType, Tag } from "../site/site.type";
import { Button, LinkButton } from "../ui/button.view";
import { confirmDialog } from "../ui/dialog.view";
import { SelectField, TextField } from "../ui/field.view";
import { Badge, PageHead } from "../ui/layout.view";
import { Dropdown } from "../ui/modal.view";
import { Table } from "../ui/table.view";
import { api, formatDate, qs } from "./client";
import { fetchPlugins } from "./plugins.view";
import { notify, notifyError } from "./toast";

const PAGE = 30;

export function ContentsView() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [types] = createResource(() =>
    api<{ items: ContentType[] }>("/api/types").then((r) => r.items),
  );
  const [tags] = createResource(() =>
    api<{ items: Tag[] }>("/api/tags").then((r) => r.items),
  );
  const [plugins] = createResource(() => fetchPlugins());
  const languages = () => {
    const state = plugins();
    if (!state?.plugins.i18n.enabled) return [];
    return [
      { value: "main", label: state.mainLang.split("-")[0].toUpperCase() },
      ...state.plugins.i18n.languages.map((l) => ({
        value: l.code,
        label: l.code.toUpperCase(),
      })),
    ];
  };
  const langLabel = (lang: string) =>
    languages().find((l) => l.value === (lang || "main"))?.label ?? lang;
  const filters = () => ({
    lang: String(params.lang ?? ""),
    type: String(params.type ?? ""),
    tag: String(params.tag ?? ""),
    status: String(params.status ?? ""),
    q: String(params.q ?? ""),
    sort: String(params.sort ?? ""),
    page: Number(params.page ?? 1) || 1,
  });
  const [list, { refetch }] = createResource(filters, (f) =>
    api<{ items: ContentSummary[]; total: number }>(
      `/api/contents${qs({ lang: f.lang, type: f.type, tag: f.tag, status: f.status, q: f.q, sort: f.sort, limit: PAGE, offset: (f.page - 1) * PAGE })}`,
    ),
  );
  const typeName = (id: string) =>
    types()?.find((t) => t.id === id)?.name ?? id;
  const pages = () => Math.max(1, Math.ceil((list()?.total ?? 0) / PAGE));

  const create = async (typeId: string) => {
    try {
      const { content } = await api<{ content: { id: string } }>(
        "/api/contents",
        { body: { typeId } },
      );
      navigate(`/admin/contents/${content.id}`);
    } catch (e) {
      notifyError(e);
    }
  };
  const duplicate = async (id: string) => {
    try {
      await api(`/api/contents/${id}/duplicate`, { method: "POST" });
      notify("Copie créée");
      refetch();
    } catch (e) {
      notifyError(e);
    }
  };
  const remove = async (row: ContentSummary) => {
    if (
      !(await confirmDialog({
        title: `Supprimer « ${row.title} » ?`,
        danger: true,
      }))
    )
      return;
    try {
      await api(`/api/contents/${row.id}`, { method: "DELETE" });
      notify("Supprimé");
      refetch();
    } catch (e) {
      notifyError(e);
    }
  };

  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  return (
    <>
      <PageHead
        title="Contenus"
        actions={
          <Dropdown
            label="Nouveau"
            icon="plus"
            items={(types() ?? []).map((t) => ({
              label: t.name,
              onSelect: () => create(t.id),
            }))}
          />
        }
      />
      <search class="ui-filters">
        <TextField
          class="ui-field--search"
          label="Recherche"
          type="search"
          value={filters().q}
          onInput={(e) => {
            const value = e.currentTarget.value;
            clearTimeout(searchTimer);
            searchTimer = setTimeout(
              () => setParams({ q: value || undefined, page: undefined }),
              250,
            );
          }}
        />
        <SelectField
          label="Type"
          empty="Tous"
          value={filters().type}
          options={(types() ?? []).map((t) => ({ value: t.id, label: t.name }))}
          onChange={(e) =>
            setParams({
              type: e.currentTarget.value || undefined,
              page: undefined,
            })
          }
        />
        <SelectField
          label="Tag"
          empty="Tous"
          value={filters().tag}
          options={(tags() ?? []).map((t) => ({ value: t.id, label: t.name }))}
          onChange={(e) =>
            setParams({
              tag: e.currentTarget.value || undefined,
              page: undefined,
            })
          }
        />
        <Show when={languages().length}>
          <SelectField
            label="Langue"
            empty="Toutes"
            value={filters().lang}
            options={languages()}
            onChange={(e) =>
              setParams({
                lang: e.currentTarget.value || undefined,
                page: undefined,
              })
            }
          />
        </Show>
        <SelectField
          label="Statut"
          empty="Tous"
          value={filters().status}
          options={[
            { value: "published", label: "Publié" },
            { value: "draft", label: "Brouillon" },
          ]}
          onChange={(e) =>
            setParams({
              status: e.currentTarget.value || undefined,
              page: undefined,
            })
          }
        />
        <SelectField
          label="Tri"
          value={filters().sort}
          options={[
            { value: "", label: "Modifié" },
            { value: "published", label: "Publié" },
            { value: "title", label: "Titre" },
          ]}
          onChange={(e) =>
            setParams({ sort: e.currentTarget.value || undefined })
          }
        />
      </search>
      <Table<ContentSummary>
        caption="Contenus"
        rows={list.latest?.items ?? []}
        empty="Aucun contenu"
        columns={[
          {
            label: "Titre",
            cell: (row) => (
              <a class="ui-table__link" href={`/admin/contents/${row.id}`}>
                {row.title}
              </a>
            ),
          },
          { label: "Type", cell: (row) => typeName(row.typeId) },
          ...(languages().length
            ? [
                {
                  label: "Langue",
                  cell: (row: ContentSummary) => (
                    <span class="ui-lang__code">{langLabel(row.lang)}</span>
                  ),
                },
              ]
            : []),
          {
            label: "Tags",
            cell: (row) => (
              <span class="ui-row-tags">
                {row.tags.map((t) => (
                  <button
                    type="button"
                    class="ui-tag ui-tag--link"
                    onClick={() => setParams({ tag: t.id, page: undefined })}
                  >
                    {t.name}
                  </button>
                ))}
              </span>
            ),
          },
          {
            label: "Statut",
            cell: (row) => (
              <Badge tone={row.status === "published" ? "success" : "neutral"}>
                {row.status === "published" ? "Publié" : "Brouillon"}
              </Badge>
            ),
          },
          {
            label: "Auteur",
            cell: (row) => <span class="ui-muted">{row.authorName ?? ""}</span>,
          },
          {
            label: "Modifié",
            cell: (row) => (
              <span class="ui-muted">{formatDate(row.updatedAt)}</span>
            ),
          },
          {
            label: "Actions",
            hideLabel: true,
            class: "ui-table__actions",
            cell: (row) => (
              <>
                <Show when={row.status === "published"}>
                  <LinkButton
                    variant="quiet"
                    size="sm"
                    icon="external"
                    href={row.url}
                    target="_blank"
                    rel="noopener"
                    aria-label={`Voir ${row.title}`}
                  />
                </Show>
                <Button
                  variant="quiet"
                  size="sm"
                  icon="copy"
                  iconOnly
                  label={`Dupliquer ${row.title}`}
                  onClick={() => duplicate(row.id)}
                />
                <Button
                  variant="quiet"
                  size="sm"
                  icon="trash"
                  iconOnly
                  label={`Supprimer ${row.title}`}
                  onClick={() => remove(row)}
                />
              </>
            ),
          },
        ]}
      />
      <Show when={pages() > 1}>
        <nav
          class="ui-toolbar"
          aria-label="Pagination"
          style={{ "justify-content": "flex-end", "margin-top": "1rem" }}
        >
          <For each={Array.from({ length: pages() }, (_, i) => i + 1)}>
            {(n) => (
              <Button
                variant="ghost"
                size="sm"
                aria-current={n === filters().page ? "page" : undefined}
                aria-pressed={n === filters().page}
                onClick={() => setParams({ page: n })}
              >
                {n}
              </Button>
            )}
          </For>
        </nav>
      </Show>
    </>
  );
}
