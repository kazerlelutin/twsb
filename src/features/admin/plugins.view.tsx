import { createResource, For, Show } from "solid-js";
import { LANGUAGE_NAMES, type Plugins } from "../site/site.type";
import { Button } from "../ui/button.view";
import { TextField, Toggle } from "../ui/field.view";
import { PageHead, Panel } from "../ui/layout.view";
import { api } from "./client";
import { notify, notifyError } from "./toast";

type PluginsState = { plugins: Plugins; mainLang: string };

/** Réglages des extensions, chargés une fois et partagés entre les vues. */
let cache: Promise<PluginsState> | undefined;
export const fetchPlugins = (fresh = false) => {
  if (fresh || !cache)
    cache = api<PluginsState>("/api/plugins").catch((e) => {
      cache = undefined;
      throw e;
    });
  return cache;
};

const langName = (code: string) => LANGUAGE_NAMES[code] ?? code.toUpperCase();

export function PluginsView() {
  const [state, { mutate }] = createResource(() => fetchPlugins(true));
  const i18n = () => state()?.plugins.i18n;
  const main = () => (state()?.mainLang ?? "fr").split("-")[0];

  const save = async (next: Plugins["i18n"]) => {
    const current = state();
    if (!current) return;
    mutate({ ...current, plugins: { ...current.plugins, i18n: next } });
    try {
      const res = await api<{ plugins: Plugins }>("/api/plugins", {
        method: "PUT",
        body: { i18n: next },
      });
      cache = Promise.resolve({ ...current, plugins: res.plugins });
      mutate({ ...current, plugins: res.plugins });
      notify("Extensions enregistrées");
    } catch (e) {
      notifyError(e);
      mutate(current);
    }
  };

  const add = (e: SubmitEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const code = String(new FormData(form).get("code") ?? "")
      .trim()
      .toLowerCase();
    const config = i18n();
    if (!config || !/^[a-z]{2,3}$/.test(code)) return;
    if (code === main() || config.languages.some((l) => l.code === code))
      return;
    save({
      ...config,
      languages: [...config.languages, { code, label: langName(code) }],
    });
    form.reset();
  };

  return (
    <>
      <PageHead title="Extensions" />
      <Show when={i18n()}>
        {(config) => (
          <div class="ui-plugins">
            <Panel
              title="Multilingue"
              action={
                <Toggle
                  label="Activer"
                  checked={config().enabled}
                  onChange={(enabled) => save({ ...config(), enabled })}
                />
              }
            >
              <Show when={config().enabled}>
                <ul class="ui-langs">
                  <li class="ui-lang">
                    <span class="ui-lang__code">{main().toUpperCase()}</span>
                    {langName(main())}
                    <span class="ui-badge">Principale</span>
                  </li>
                  <For each={config().languages}>
                    {(l) => (
                      <li class="ui-lang">
                        <span class="ui-lang__code">
                          {l.code.toUpperCase()}
                        </span>
                        {l.label}
                        <span class="ui-muted">/{l.code}/…</span>
                        <Button
                          variant="quiet"
                          size="sm"
                          icon="trash"
                          iconOnly
                          label={`Retirer ${l.label}`}
                          onClick={() =>
                            save({
                              ...config(),
                              languages: config().languages.filter(
                                (x) => x.code !== l.code,
                              ),
                            })
                          }
                        />
                      </li>
                    )}
                  </For>
                </ul>
                <form class="ui-inline-form" onSubmit={add}>
                  <TextField
                    label="Code de langue"
                    name="code"
                    placeholder="en"
                    maxlength={3}
                    list="lang-codes"
                  />
                  <datalist id="lang-codes">
                    <For each={Object.entries(LANGUAGE_NAMES)}>
                      {([code, name]) => <option value={code}>{name}</option>}
                    </For>
                  </datalist>
                  <Button variant="ghost" icon="plus" type="submit">
                    Ajouter
                  </Button>
                </form>
              </Show>
            </Panel>
          </div>
        )}
      </Show>
    </>
  );
}
