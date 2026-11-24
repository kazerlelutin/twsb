import { createSignal, createUniqueId, Show } from "solid-js";
import { Button } from "./button.view";
import { Modal } from "./modal.view";

type Request = {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  /** Présent : demande une saisie (remplace window.prompt). */
  input?: { label: string; value?: string; placeholder?: string };
  resolve: (value: string | boolean | null) => void;
};

const [current, setCurrent] = createSignal<Request | null>(null);

function open(request: Omit<Request, "resolve">) {
  current()?.resolve(null);
  return new Promise<string | boolean | null>((resolve) =>
    setCurrent({ ...request, resolve }),
  );
}

/** Confirmation dans une modale : remplace window.confirm. */
export const confirmDialog = async (
  options: Omit<Request, "resolve" | "input">,
) => (await open(options)) === true;

/** Saisie courte dans une modale : remplace window.prompt. */
export const promptDialog = async (
  options: Omit<Request, "resolve" | "input"> & {
    label: string;
    value?: string;
    placeholder?: string;
  },
) => {
  const { label, value, placeholder, ...rest } = options;
  const result = await open({ ...rest, input: { label, value, placeholder } });
  return typeof result === "string" ? result : null;
};

/** Hôte unique des dialogues, monté une fois dans l'administration. */
export function DialogHost() {
  const inputId = createUniqueId();
  let field: HTMLInputElement | undefined;
  const close = (value: string | boolean | null) => {
    const request = current();
    setCurrent(null);
    request?.resolve(value);
  };
  return (
    <Modal
      open={!!current()}
      title={current()?.title ?? ""}
      onClose={() => close(null)}
      footer={
        <>
          <Button variant="ghost" onClick={() => close(null)}>
            Annuler
          </Button>
          <Button
            variant={current()?.danger ? "danger" : "solid"}
            type="submit"
            form={`${inputId}-form`}
          >
            {current()?.confirmLabel ??
              (current()?.danger ? "Supprimer" : "OK")}
          </Button>
        </>
      }
    >
      <form
        id={`${inputId}-form`}
        class="ui-dialog"
        onSubmit={(e) => {
          e.preventDefault();
          const input = current()?.input;
          close(input ? (field?.value.trim() ?? "") : true);
        }}
      >
        <Show when={current()?.message}>
          <p class="ui-dialog__message">{current()?.message}</p>
        </Show>
        <Show when={current()?.input}>
          {(input) => (
            <div class="ui-field">
              <label class="ui-field__label" for={inputId}>
                {input().label}
              </label>
              <input
                ref={(el) => {
                  field = el;
                  queueMicrotask(() => el.select());
                }}
                id={inputId}
                class="ui-input"
                value={input().value ?? ""}
                placeholder={input().placeholder}
                required
                autofocus
              />
            </div>
          )}
        </Show>
      </form>
    </Modal>
  );
}
