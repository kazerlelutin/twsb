import {
  createResource,
  createSignal,
  For,
  type JSX,
  onCleanup,
  Show,
} from "solid-js";
import { Button } from "../ui/button.view";
import { confirmDialog } from "../ui/dialog.view";
import { TextField, Toggle } from "../ui/field.view";
import { Badge, Notice, PageHead, Panel } from "../ui/layout.view";
import { api } from "./client";
import { formatDateTime } from "./history.view";
import { formatBytes } from "./settings.view";
import { notify, notifyError } from "./toast";

type Step =
  | "idle"
  | "backup"
  | "download"
  | "verify"
  | "install"
  | "restart"
  | "manual"
  | "error";

type Status = {
  version: string;
  bundledVersion: string;
  repo: string;
  launcher: boolean;
  latest?: {
    version: string;
    name: string;
    notes: string;
    publishedAt: string;
    url: string;
    asset?: { name: string; size: number };
  };
  checkError?: string;
  checkedAt: number;
  updateAvailable: boolean;
  previous?: string;
  failed: { version: string; at: number; reason: string }[];
  progress: { step: Step; version?: string; message?: string };
  backups: {
    name: string;
    version: string;
    reason: string;
    createdAt: number;
    size: number;
  }[];
  config: {
    publicUrl: string;
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      user: string;
      pass: string;
      from: string;
      hasPass: boolean;
    };
    effective: {
      publicUrl: string;
      sources: { publicUrl: string; smtp: string };
    };
  };
};

const STEPS: Partial<Record<Step, string>> = {
  backup: "Sauvegarde de la base…",
  download: "Téléchargement…",
  verify: "Vérification de l'archive…",
  install: "Installation…",
  restart: "Redémarrage…",
};

/** Attend le redémarrage : la page se recharge dès que le serveur répond. */
async function waitForRestart(from: string) {
  const deadline = Date.now() + 180_000;
  await new Promise((r) => setTimeout(r, 2000));
  while (Date.now() < deadline) {
    try {
      const res = await fetch("/healthz", { cache: "no-store" });
      if (res.ok) {
        const { version } = await res.json();
        if (version) {
          window.location.reload();
          return version !== from;
        }
      }
    } catch {
      // Serveur en cours de redémarrage.
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

/** Mise en forme d'un texte : **gras**, `code`, [lien](url) et adresses nues. */
function inline(text: string): JSX.Element[] {
  const out: JSX.Element[] = [];
  const pattern =
    /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s)]+)/g;
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong>{m[1]}</strong>);
    else if (m[2]) out.push(<code>{m[2]}</code>);
    else {
      const href = m[4] ?? m[5];
      const label =
        m[3] ?? href.replace(/^https?:\/\/(www\.)?github\.com\//, "");
      out.push(
        <a href={href} target="_blank" rel="noopener">
          {label}
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Notes de version (Markdown simple de GitHub), sans HTML injecté. */
function ReleaseNotes(props: { text: string }) {
  const blocks = () => {
    const result: { kind: "h" | "p" | "ul"; lines: string[] }[] = [];
    for (const raw of props.text.replace(/\r/g, "").split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      const item = line.match(/^[-*]\s+(.*)$/);
      const heading = line.match(/^#{1,6}\s+(.*)$/);
      const previous = result.at(-1);
      if (item) {
        if (previous?.kind === "ul") previous.lines.push(item[1]);
        else result.push({ kind: "ul", lines: [item[1]] });
      } else if (heading) {
        // « Nouveautés » répète le titre du bloc.
        if (!/^nouveaut[ée]s$/i.test(heading[1].trim()))
          result.push({ kind: "h", lines: [heading[1]] });
      } else result.push({ kind: "p", lines: [line] });
    }
    return result;
  };
  return (
    <div class="ui-notes">
      <For each={blocks()}>
        {(b) =>
          b.kind === "ul" ? (
            <ul>
              <For each={b.lines}>{(l) => <li>{inline(l)}</li>}</For>
            </ul>
          ) : b.kind === "h" ? (
            <p class="ui-notes__title">{inline(b.lines[0])}</p>
          ) : (
            <p>{inline(b.lines[0])}</p>
          )
        }
      </For>
    </div>
  );
}

export function SystemView() {
  const [checking, setChecking] = createSignal(false);
  const [status, { mutate, refetch }] = createResource(() =>
    api<Status>("/api/system"),
  );
  const [busy, setBusy] = createSignal<string>();
  let poll: ReturnType<typeof setInterval> | undefined;
  onCleanup(() => clearInterval(poll));

  const check = async () => {
    setChecking(true);
    try {
      mutate(await api<Status>("/api/system?check=1"));
    } catch (e) {
      notifyError(e);
    } finally {
      setChecking(false);
    }
  };

  const update = async () => {
    const s = status();
    const target = s?.latest;
    if (!s || !target) return;
    const ok = await confirmDialog({
      title: `Mettre à jour en ${target.version} ?`,
      message:
        "La base est sauvegardée, la nouvelle version est installée puis lancée. Si elle ne démarre pas, la base est restaurée et l'ancienne version reprend.",
      confirmLabel: "Mettre à jour",
    });
    if (!ok) return;
    setBusy("update");
    poll = setInterval(
      () =>
        api<Status>("/api/system")
          .then(mutate)
          .catch(() => undefined),
      1500,
    );
    try {
      const { progress } = await api<{ progress: Status["progress"] }>(
        "/api/system/update",
        { method: "POST" },
      );
      mutate({ ...s, progress });
      if (progress.step === "restart") {
        clearInterval(poll);
        await waitForRestart(s.version);
      }
    } catch (e) {
      notifyError(e);
    } finally {
      clearInterval(poll);
      setBusy(undefined);
      refetch();
    }
  };

  const revert = async (backup: Status["backups"][number]) => {
    const ok = await confirmDialog({
      title: "Revenir à cette sauvegarde ?",
      message: `La base revient à l'état du ${formatDateTime(backup.createdAt)}, en version ${backup.version}. Les modifications faites depuis seront perdues.`,
      confirmLabel: "Revenir",
      danger: true,
    });
    if (!ok) return;
    setBusy("revert");
    try {
      await api("/api/system/revert", { body: { name: backup.name } });
      mutate((s) =>
        s
          ? { ...s, progress: { step: "restart", version: backup.version } }
          : s,
      );
      await waitForRestart("");
    } catch (e) {
      notifyError(e);
      setBusy(undefined);
    }
  };

  const backupNow = async () => {
    setBusy("backup");
    try {
      await api("/api/system/backups", { method: "POST" });
      notify("Sauvegarde créée");
      refetch();
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(undefined);
    }
  };

  const removeBackup = async (name: string) => {
    if (
      !(await confirmDialog({
        title: "Supprimer cette sauvegarde ?",
        danger: true,
      }))
    )
      return;
    try {
      await api(`/api/system/backups/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      refetch();
    } catch (e) {
      notifyError(e);
    }
  };

  return (
    <>
      <PageHead title="Système" />
      <Show when={status()}>
        {(s) => (
          <div class="ui-data">
            <div class="ui-data__row">
              <Panel title="Version">
                <div class="ui-system">
                  <dl class="ui-stats ui-stats--two">
                    <div>
                      <dt>En service</dt>
                      <dd>{s().version}</dd>
                    </div>
                    <div>
                      <dt>Dernière publiée</dt>
                      <dd>{s().latest?.version ?? "—"}</dd>
                    </div>
                  </dl>
                  <Show when={s().checkError}>
                    <Notice tone="warning">{s().checkError}</Notice>
                  </Show>
                  <Show when={!s().launcher}>
                    <Notice tone="warning">
                      Lancement sans le lanceur : mise à jour et retour arrière
                      automatiques indisponibles.
                    </Notice>
                  </Show>
                  <For each={s().failed.slice(-1)}>
                    {(f) => (
                      <Notice tone="danger">
                        Échec de la version {f.version} ({f.reason}) le{" "}
                        {formatDateTime(f.at)} : base restaurée.
                      </Notice>
                    )}
                  </For>
                  <Show when={STEPS[s().progress.step]}>
                    <Notice tone="info">{STEPS[s().progress.step]}</Notice>
                  </Show>
                  <Show
                    when={
                      s().progress.step === "error" ||
                      s().progress.step === "manual"
                    }
                  >
                    <Notice
                      tone={
                        s().progress.step === "error" ? "danger" : "warning"
                      }
                    >
                      {s().progress.message}
                    </Notice>
                  </Show>
                  <Show when={s().updateAvailable && s().latest}>
                    {(latest) => (
                      <details class="ui-release-notes" open>
                        <summary>Nouveautés de {latest().version}</summary>
                        <ReleaseNotes text={latest().notes} />
                        <Show when={latest().url}>
                          <a
                            class="ui-table__link"
                            href={latest().url}
                            target="_blank"
                            rel="noopener"
                          >
                            Voir la version sur GitHub
                          </a>
                        </Show>
                      </details>
                    )}
                  </Show>
                  <div class="ui-toolbar">
                    <Button
                      variant="ghost"
                      icon="undo"
                      disabled={checking() || !!busy()}
                      onClick={check}
                    >
                      Vérifier
                    </Button>
                    <Show when={s().updateAvailable}>
                      <Button
                        variant="solid"
                        icon="download"
                        disabled={!!busy() || !s().latest?.asset}
                        onClick={update}
                      >
                        Mettre à jour en {s().latest?.version}
                      </Button>
                    </Show>
                    <Show when={!s().updateAvailable && s().latest}>
                      <Badge tone="success">À jour</Badge>
                    </Show>
                  </div>
                </div>
              </Panel>
              <Panel
                title="Sauvegardes"
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="save"
                    disabled={!!busy()}
                    onClick={backupNow}
                  >
                    Sauvegarder
                  </Button>
                }
              >
                <Show
                  when={s().backups.length}
                  fallback={<p class="ui-muted">Aucune</p>}
                >
                  <ol class="ui-history">
                    <For each={s().backups}>
                      {(b) => (
                        <li class="ui-history__item">
                          <div class="ui-history__main">
                            <span class="ui-history__label">
                              {b.reason || "Sauvegarde"}
                            </span>
                            <span class="ui-muted">
                              {formatDateTime(b.createdAt)} | v{b.version} |{" "}
                              {formatBytes(b.size)}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon="undo"
                            disabled={!!busy() || !s().launcher}
                            aria-label={`Revenir à la sauvegarde du ${formatDateTime(b.createdAt)}`}
                            onClick={() => revert(b)}
                          >
                            Revenir
                          </Button>
                          <Button
                            variant="quiet"
                            size="sm"
                            icon="trash"
                            iconOnly
                            label={`Supprimer la sauvegarde du ${formatDateTime(b.createdAt)}`}
                            onClick={() => removeBackup(b.name)}
                          />
                        </li>
                      )}
                    </For>
                  </ol>
                </Show>
              </Panel>
            </div>
            <ConfigPanel
              status={s()}
              onSaved={(config) => mutate({ ...s(), config })}
            />
          </div>
        )}
      </Show>
    </>
  );
}

/** URL publique et SMTP, réglables après l'installation (l'environnement reste prioritaire). */
function ConfigPanel(props: {
  status: Status;
  onSaved: (config: Status["config"]) => void;
}) {
  const initial = props.status.config;
  const [publicUrl, setPublicUrl] = createSignal(
    initial.publicUrl || initial.effective.publicUrl,
  );
  const [smtp, setSmtp] = createSignal({ ...initial.smtp });
  const sources = () => props.status.config.effective.sources;
  const patch = (p: Partial<Status["config"]["smtp"]>) =>
    setSmtp({ ...smtp(), ...p });
  const save = async (e: SubmitEvent) => {
    e.preventDefault();
    try {
      const { config } = await api<{ config: Status["config"] }>(
        "/api/system/config",
        {
          method: "PUT",
          body: { publicUrl: publicUrl(), smtp: smtp() },
        },
      );
      setSmtp({ ...config.smtp });
      props.onSaved(config);
      notify("Configuration enregistrée");
    } catch (err) {
      notifyError(err);
    }
  };
  const test = async () => {
    try {
      const { to } = await api<{ to: string }>("/api/system/mail-test", {
        method: "POST",
      });
      notify(`E-mail de test envoyé à ${to}`);
    } catch (err) {
      notifyError(err);
    }
  };
  return (
    <Panel title="Configuration">
      <form class="ui-config" onSubmit={save}>
        <TextField
          label="URL publique"
          type="url"
          placeholder="https://mon-site.fr"
          value={publicUrl()}
          disabled={sources().publicUrl === "env"}
          hint={
            sources().publicUrl === "env" ? "Fixée par PUBLIC_URL" : undefined
          }
          onInput={(e) => setPublicUrl(e.currentTarget.value)}
        />
        <fieldset class="ui-config__smtp" disabled={sources().smtp === "env"}>
          <legend class="ui-field__label">
            SMTP{sources().smtp === "env" ? " | fixé par l'environnement" : ""}
          </legend>
          <TextField
            label="Serveur"
            placeholder="smtp.exemple.fr"
            value={smtp().host}
            onInput={(e) => patch({ host: e.currentTarget.value })}
          />
          <TextField
            label="Port"
            type="number"
            value={smtp().port}
            onInput={(e) =>
              patch({ port: Number(e.currentTarget.value) || 587 })
            }
          />
          <TextField
            label="Utilisateur"
            autocomplete="off"
            value={smtp().user}
            onInput={(e) => patch({ user: e.currentTarget.value })}
          />
          <TextField
            label="Mot de passe"
            type="password"
            autocomplete="new-password"
            placeholder={smtp().hasPass ? "Inchangé" : ""}
            value={smtp().pass}
            onInput={(e) => patch({ pass: e.currentTarget.value })}
          />
          <TextField
            label="Expéditeur"
            placeholder="Mon site <no-reply@mon-site.fr>"
            value={smtp().from}
            onInput={(e) => patch({ from: e.currentTarget.value })}
          />
          <Toggle
            label="TLS direct (port 465)"
            checked={smtp().secure}
            onChange={(secure) => patch({ secure })}
          />
        </fieldset>
        <div class="ui-toolbar">
          <Button type="submit" variant="solid" icon="save">
            Enregistrer
          </Button>
          <Button
            variant="ghost"
            disabled={sources().smtp === "none"}
            onClick={test}
          >
            Envoyer un test
          </Button>
        </div>
      </form>
    </Panel>
  );
}
