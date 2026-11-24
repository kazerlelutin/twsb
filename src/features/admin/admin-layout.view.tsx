import { useLocation, useNavigate } from "@solidjs/router";
import { createEffect, For, type ParentProps, Show } from "solid-js";
import { DialogHost } from "../ui/dialog.view";
import { Icon } from "../ui/icons.view";
import { AppShell, type NavItem } from "../ui/shell.view";
import { logout, session } from "./session";
import { toasts } from "./toast";

const PUBLIC = ["/admin/login", "/admin/activate", "/admin/forgot"];

const items = (admin: boolean): NavItem[] => [
  {
    href: "/admin",
    label: "Contenus",
    icon: "file",
    match: (p) => p === "/admin" || p.startsWith("/admin/contents"),
  },
  { href: "/admin/media", label: "Médias", icon: "image" },
  { href: "/admin/tags", label: "Tags", icon: "link" },
  { href: "/admin/menus", label: "Menus", icon: "menu" },
  ...(admin
    ? [
        {
          href: "/admin/types",
          label: "Types",
          icon: "type",
          match: (p: string) => p.startsWith("/admin/types"),
        },
        {
          href: "/admin/layouts",
          label: "Layouts",
          icon: "layout",
          match: (p: string) => p.startsWith("/admin/layouts"),
        },
        { href: "/admin/identity", label: "Identité", icon: "palette" },
        { href: "/admin/plugins", label: "Extensions", icon: "plugin" },
        { href: "/admin/users", label: "Comptes", icon: "users" },
        { href: "/admin/data", label: "Données", icon: "database" },
      ]
    : []),
];

function Toasts() {
  return (
    <div class="ui-toasts" aria-live="polite">
      <For each={toasts.list()}>
        {(t) => (
          <div
            class={`ui-toast ui-toast--${t.tone}`}
            role={t.tone === "danger" ? "alert" : "status"}
          >
            {t.text}
          </div>
        )}
      </For>
    </div>
  );
}

export function AdminLayout(props: ParentProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isPublic = () => PUBLIC.some((p) => location.pathname.startsWith(p));

  createEffect(() => {
    if (!isPublic() && session.user.state === "ready" && !session.user()) {
      navigate(`/admin/login?next=${encodeURIComponent(location.pathname)}`, {
        replace: true,
      });
    }
  });

  return (
    <>
      <Show when={!isPublic()} fallback={props.children}>
        <Show when={session.user()}>
          {(user) => (
            <AppShell
              brand="TWSB"
              context={user().name || user().email}
              items={items(user().role === "admin")}
              currentPath={location.pathname}
              footer={
                <ul class="ui-nav__links">
                  <li>
                    <a href="/" target="_blank" rel="noopener">
                      <Icon name="external" />
                      Voir le site
                    </a>
                  </li>
                  <li>
                    <button type="button" onClick={logout}>
                      <Icon name="logout" />
                      Déconnexion
                    </button>
                  </li>
                </ul>
              }
            >
              {props.children}
            </AppShell>
          )}
        </Show>
      </Show>
      <Toasts />
      <DialogHost />
    </>
  );
}
