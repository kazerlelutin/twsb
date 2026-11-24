import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, describe, expect, test, vi } from "vitest";
import { configureAxe } from "vitest-axe";
import { Button } from "./button.view";
import {
  ColorField,
  RangeField,
  Segmented,
  SelectField,
  TextField,
  Toggle,
} from "./field.view";
import { Badge, Notice, PageHead, Panel } from "./layout.view";
import { AppShell } from "./shell.view";
import { Table } from "./table.view";

afterEach(cleanup);

// Le contraste est vérifié dans un vrai navigateur par les tests E2E.
const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });

describe("bibliothèque d'interface", () => {
  test("un bouton icône seule porte un nom accessible", async () => {
    const onClick = vi.fn();
    const { container } = render(() => (
      <Button icon="trash" iconOnly label="Supprimer" onClick={onClick} />
    ));
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    expect(onClick).toHaveBeenCalled();
    expect(await axe(container)).toHaveNoViolations();
  });

  test("un champ en erreur est signalé et décrit", async () => {
    const { container } = render(() => (
      <TextField label="E-mail" error="Adresse invalide" />
    ));
    const input = screen.getByLabelText("E-mail");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Adresse invalide");
    expect(await axe(container)).toHaveNoViolations();
  });

  test("les champs de réglage restent accessibles", async () => {
    const { container } = render(() => (
      <form>
        <SelectField
          label="Type"
          options={[{ value: "a", label: "A" }]}
          value="a"
        />
        <Toggle label="Ombre" checked={false} onChange={() => undefined} />
        <ColorField label="Fond" value="#ffffff" onChange={() => undefined} />
        <RangeField label="Arrondi" value={4} onChange={() => undefined} />
      </form>
    ));
    expect(screen.getByRole("switch", { name: "Ombre" })).not.toBeChecked();
    expect(await axe(container)).toHaveNoViolations();
  });

  test("le sélecteur segmenté indique l'option active", () => {
    const [value, setValue] = createSignal<"desktop" | "mobile">("desktop");
    render(() => (
      <Segmented
        label="Appareil"
        value={value()}
        onChange={setValue}
        options={[
          { value: "desktop", label: "Ordinateur" },
          { value: "mobile", label: "Mobile" },
        ]}
      />
    ));
    fireEvent.click(screen.getByRole("button", { name: "Mobile" }));
    expect(screen.getByRole("button", { name: "Mobile" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("group", { name: "Appareil" })).toBeInTheDocument();
  });

  test("un panneau, un en-tête, un avis et un badge", async () => {
    const { container } = render(() => (
      <main>
        <PageHead title="Contenus" />
        <Panel title="Réglages">
          <Badge tone="success">Publié</Badge>
          <Notice tone="danger">Erreur</Notice>
        </Panel>
      </main>
    ));
    expect(
      screen.getByRole("region", { name: "Réglages" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Erreur");
    expect(await axe(container)).toHaveNoViolations();
  });

  test("un tableau vide affiche un état neutre", () => {
    render(() => (
      <Table
        caption="Comptes"
        rows={[]}
        columns={[{ label: "E-mail", cell: () => "" }]}
        empty="Aucun compte"
      />
    ));
    expect(screen.getByText("Aucun compte")).toBeInTheDocument();
  });

  test("un tableau est nommé et défilable au clavier", async () => {
    const { container } = render(() => (
      <Table
        caption="Comptes"
        rows={[{ email: "a@b.c" }]}
        columns={[{ label: "E-mail", cell: (r) => r.email }]}
      />
    ));
    expect(screen.getByRole("region", { name: "Comptes" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  test("la navigation signale la page courante et se replie sur mobile", async () => {
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    const { container } = render(() => (
      <AppShell
        brand="TWSB"
        currentPath="/admin/media"
        items={[
          { href: "/admin", label: "Contenus", icon: "file" },
          { href: "/admin/media", label: "Médias", icon: "image" },
        ]}
      >
        <p>Contenu</p>
      </AppShell>
    ));
    const trigger = screen.getByRole("button", { name: "Menu" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(screen.getByRole("link", { name: "Médias" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(await axe(container)).toHaveNoViolations();
  });
});
