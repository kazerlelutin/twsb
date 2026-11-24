import { useNavigate, useSearchParams } from "@solidjs/router";
import { createResource, createSignal, type JSX, Show } from "solid-js";
import { Button } from "../ui/button.view";
import { TextField } from "../ui/field.view";
import { Notice, Panel } from "../ui/layout.view";
import { api } from "./client";
import { session } from "./session";

function AuthCard(props: { title: string; children: JSX.Element }) {
  return (
    <main class="ui-auth" id="main">
      <Panel>
        <p class="ui-brand">
          <img class="ui-brand__mark" src="/twsb-mark.svg" alt="" />
          TWSB
        </p>
        <h1 class="ui-panel__title" style={{ "margin-bottom": "1rem" }}>
          {props.title}
        </h1>
        {props.children}
      </Panel>
    </main>
  );
}

const safeNext = (value: unknown) =>
  typeof value === "string" &&
  value.startsWith("/admin") &&
  !value.startsWith("//")
    ? value
    : "/admin";

export function LoginView() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget as HTMLFormElement);
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", {
        body: { email: form.get("email"), password: form.get("password") },
      });
      await session.refetch();
      navigate(safeNext(params.next), { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthCard title="Connexion">
      <form onSubmit={submit}>
        <TextField
          label="E-mail"
          name="email"
          type="email"
          autocomplete="username"
          required
        />
        <TextField
          label="Mot de passe"
          name="password"
          type="password"
          autocomplete="current-password"
          required
        />
        <Show when={error()}>
          <Notice tone="danger">{error()}</Notice>
        </Show>
        <Button type="submit" variant="solid" disabled={busy()}>
          Se connecter
        </Button>
      </form>
      <p style={{ "margin-top": "1rem", "text-align": "center" }}>
        <a class="ui-table__link" href="/admin/forgot">
          Mot de passe oublié
        </a>
      </p>
    </AuthCard>
  );
}

export function ForgotView() {
  const [sent, setSent] = createSignal(false);
  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget as HTMLFormElement);
    await api("/api/auth/forgot", { body: { email: form.get("email") } }).catch(
      () => undefined,
    );
    setSent(true);
  };
  return (
    <AuthCard title="Mot de passe oublié">
      <Show
        when={!sent()}
        fallback={
          <Notice tone="success">
            Si un compte existe, un lien vient d'être envoyé.
          </Notice>
        }
      >
        <form onSubmit={submit}>
          <TextField
            label="E-mail"
            name="email"
            type="email"
            autocomplete="username"
            required
          />
          <Button type="submit" variant="solid">
            Envoyer le lien
          </Button>
        </form>
      </Show>
      <p style={{ "margin-top": "1rem", "text-align": "center" }}>
        <a class="ui-table__link" href="/admin/login">
          Connexion
        </a>
      </p>
    </AuthCard>
  );
}

export function ActivateView() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = () => String(params.token ?? "");
  const [info] = createResource(token, (t) =>
    api<{ email: string; name: string }>(
      `/api/auth/activate?token=${encodeURIComponent(t)}`,
    ),
  );
  const [error, setError] = createSignal("");
  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget as HTMLFormElement);
    if (form.get("password") !== form.get("confirm"))
      return setError("Les mots de passe diffèrent.");
    try {
      await api("/api/auth/activate", {
        body: {
          token: token(),
          password: form.get("password"),
          name: form.get("name"),
        },
      });
      await session.refetch();
      navigate("/admin", { replace: true });
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <AuthCard title="Activer le compte">
      <Show
        when={!info.error}
        fallback={<Notice tone="danger">Lien expiré ou invalide.</Notice>}
      >
        <Show when={info()}>
          {(data) => (
            <form onSubmit={submit}>
              <TextField label="E-mail" value={data().email} readonly />
              <TextField
                label="Nom"
                name="name"
                value={data().name}
                autocomplete="name"
              />
              <TextField
                label="Mot de passe"
                name="password"
                type="password"
                autocomplete="new-password"
                minlength={10}
                required
                hint="10 caractères min."
              />
              <TextField
                label="Confirmation"
                name="confirm"
                type="password"
                autocomplete="new-password"
                required
              />
              <Show when={error()}>
                <Notice tone="danger">{error()}</Notice>
              </Show>
              <Button type="submit" variant="solid">
                Activer
              </Button>
            </form>
          )}
        </Show>
      </Show>
    </AuthCard>
  );
}
