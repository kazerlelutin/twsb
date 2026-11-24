import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";
import { testEnv } from "../../env";

const { Given, When, Then } = createBdd();

/** Choisit, dans la colonne du contenu, le champ à saisir dans la page. */
const pickField = async (
  page: import("@playwright/test").Page,
  label: string,
) => {
  const picker = page.getByRole("group", { name: "Champs" });
  if (!(await picker.count())) return;
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await picker.getByText(new RegExp(`^${escaped}( \\*)?$`)).click();
  await expect(
    picker.getByRole("radio", { name: new RegExp(`^${escaped}( \\*)? `) }),
  ).toBeChecked();
};

const ADMIN = testEnv.admin;

Given("je suis sur la page de connexion", async ({ page }) => {
  await page.goto("/admin/login");
});

const signIn = async (
  page: import("@playwright/test").Page,
  email: string,
  secret: string,
) => {
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(secret);
  await page.getByRole("button", { name: "Se connecter" }).click();
};

When(
  "je me connecte avec les identifiants de l'administrateur",
  async ({ page }) => signIn(page, ADMIN.email, ADMIN.password),
);

When("je me connecte avec un mauvais mot de passe", async ({ page }) =>
  signIn(page, ADMIN.email, testEnv.wrongPassword),
);

Given("je suis connecté en administrateur", async ({ page }) => {
  // Sur un serveur de dev neuf, Vite peut recharger la page pendant la
  // première connexion (optimisation des dépendances) : on retente une fois.
  for (let attempt = 0; ; attempt++) {
    await page.goto("/admin/login");
    await page.getByLabel("E-mail").fill(ADMIN.email);
    await page.getByLabel("Mot de passe").fill(ADMIN.password);
    await page.getByRole("button", { name: "Se connecter" }).click();
    const heading = page.getByRole("heading", { name: "Contenus" });
    try {
      await expect(heading).toBeVisible({ timeout: attempt ? 10000 : 5000 });
      return;
    } catch (error) {
      if (attempt) throw error;
    }
  }
});

Then("je vois la liste des contenus", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Contenus" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Contenus" })).toBeVisible();
});

Then("je vois l'erreur {string}", async ({ page }, message: string) => {
  await expect(page.getByRole("alert")).toHaveText(message);
});

When("j'ouvre {string}", async ({ page }, path: string) => {
  await page.goto(path);
});

Then("je suis redirigé vers la connexion", async ({ page }) => {
  await expect(page).toHaveURL(/\/admin\/login/);
});

When("je crée un contenu de type {string}", async ({ page }, type: string) => {
  await page.goto("/admin");
  await page.getByRole("button", { name: "Nouveau" }).click();
  await page.getByRole("button", { name: type, exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/contents\//);
});

When("je renomme le contenu en {string}", async ({ page }, title: string) => {
  const input = page.getByRole("textbox", { name: "Titre", exact: true });
  await input.fill(title);
  await page.getByLabel("Adresse", { exact: true }).fill(title);
  await page.getByLabel("Adresse", { exact: true }).blur();
});

When("j'ajoute le bloc {string}", async ({ page }, label: string) => {
  await page
    .getByRole("complementary", { name: "Blocs" })
    .getByRole("button", { name: label, exact: true })
    .click();
});

When(
  "je saisis {string} dans le champ {string}",
  async ({ page }, value: string, label: string) => {
    await page
      .getByRole("complementary", { name: "Réglages" })
      .getByLabel(label, { exact: true })
      .fill(value);
  },
);

Then("l'aperçu affiche {string}", async ({ page }, text: string) => {
  await expect(
    page.frameLocator('iframe[title="Aperçu de la page"]').getByText(text),
  ).toBeVisible();
});

When("je publie le contenu", async ({ page }) => {
  await page.getByRole("button", { name: "Publier" }).click();
  await expect(page.getByText("Publié", { exact: true }).first()).toBeVisible();
});

Then(
  "la page publique {string} affiche {string}",
  async ({ page }, path: string, text: string) => {
    const response = await page.request.get(path);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain(text);
  },
);

When("je passe l'éditeur en mobile", async ({ page }) => {
  await page.getByRole("button", { name: "Mobile" }).click();
});

When("j'ouvre l'onglet {string}", async ({ page }, tab: string) => {
  await page.getByRole("tab", { name: tab }).click();
});

When("j'active l'option {string}", async ({ page }, label: string) => {
  await page.getByRole("switch", { name: label }).check();
});

Then("l'aperçu indique {string}", async ({ page }, text: string) => {
  await expect(page.getByText(text)).toBeVisible();
});

Then(
  "la page publique {string} masque un bloc sous 768 pixels",
  async ({ page }, path: string) => {
    const res = await page.request.get(path);
    expect(await res.text()).toMatch(
      /@media \(max-width:768px\)\{\.b-[\w-]+\{display:none\}\}/,
    );
  },
);

When("je titre le document {string}", async ({ page }, title: string) => {
  await page.getByRole("textbox", { name: "Titre", exact: true }).fill(title);
  await page.getByLabel("Adresse", { exact: true }).fill(title);
  await page.getByLabel("Adresse", { exact: true }).blur();
});

When(
  "j'insère un {string} via la commande slash avec le texte {string}",
  async ({ page }, item: string, text: string) => {
    const editor = page.getByRole("textbox", { name: "Corps" });
    await editor.click();
    await page.keyboard.type("/");
    await page.getByRole("option", { name: item }).click();
    await page.keyboard.type(text);
    await expect(editor.locator("h2")).toHaveText(text);
  },
);

When(
  "je filtre les contenus par type {string}",
  async ({ page }, type: string) => {
    await page.getByLabel("Type").selectOption({ label: type });
  },
);

Then("je vois {string} dans la liste", async ({ page }, title: string) => {
  await expect(
    page.getByRole("link", { name: title, exact: true }),
  ).toBeVisible();
});

Then(
  "je ne vois pas {string} dans la liste",
  async ({ page }, title: string) => {
    await expect(
      page.getByRole("link", { name: title, exact: true }),
    ).toHaveCount(0);
  },
);

When(
  "je remplace le champ {string} par {string}",
  async ({ page }, label: string, value: string) => {
    await page.getByLabel(label, { exact: true }).fill(value);
  },
);

When("j'enregistre", async ({ page }) => {
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "enregistré" }).first(),
  ).toBeVisible();
});

Then(
  "la page publique {string} a pour titre {string}",
  async ({ page }, path: string, title: string) => {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
  },
);

Then(
  "la page ne présente aucune violation d'accessibilité",
  async ({ page }) => {
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude("#solid-dev-toolbar")
      .analyze();
    const summary = results.violations.map(
      (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
    );
    expect(summary).toEqual([]);
  },
);

Given("un écran de téléphone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
});

When("j'ouvre le menu du site", async ({ page }) => {
  await page.getByRole("button", { name: "Menu" }).click();
});

When("j'appuie sur Échap", async ({ page }) => {
  await page.keyboard.press("Escape");
});

Then("le lien {string} est visible", async ({ page }, name: string) => {
  await expect(
    page.getByRole("navigation").getByRole("link", { name }),
  ).toBeVisible();
});

Then("le lien {string} est masqué", async ({ page }, name: string) => {
  await expect(
    page.getByRole("navigation").getByRole("link", { name }),
  ).toBeHidden();
});

const loaded = (img: HTMLImageElement) => img.complete && img.naturalWidth > 0;

When(
  "j'envoie l'image {string} dans la médiathèque",
  async ({ page }, file: string) => {
    await page.goto("/admin/media");
    await page
      .locator('input[type="file"]')
      .setInputFiles(`tests/e2e/fixtures/${file}`);
    await expect(
      page.getByRole("status").filter({ hasText: "Fichier envoyé" }),
    ).toBeVisible();
  },
);

Then("la vignette de {string} s'affiche", async ({ page }, name: string) => {
  const img = page.getByRole("button", { name, exact: true }).locator("img");
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate(loaded)).toBe(true);
});

When(
  "je choisis l'image {string} pour le champ {string}",
  async ({ page }, name: string, label: string) => {
    await page.getByRole("button", { name: `${label} | choisir` }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name, exact: true })
      .click();
  },
);

Then("l'aperçu affiche une image chargée", async ({ page }) => {
  const img = page
    .frameLocator('iframe[title="Aperçu de la page"]')
    .locator(".wsb-image img");
  await expect(img).toBeVisible();
  // Chargement différé : l'image doit être à l'écran pour se charger.
  await img.scrollIntoViewIfNeeded();
  await expect.poll(() => img.evaluate(loaded)).toBe(true);
});

Then(
  "la page publique {string} affiche une image webp chargée",
  async ({ page }, path: string) => {
    await page.goto(path);
    const img = page.locator(".wsb-image img");
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate(loaded)).toBe(true);
    expect(await img.evaluate((el: HTMLImageElement) => el.currentSrc)).toMatch(
      /\.webp$/,
    );
  },
);

const preview = (page: import("@playwright/test").Page) =>
  page.frameLocator('iframe[title="Aperçu de la page"]');
const settings = (page: import("@playwright/test").Page) =>
  page.getByRole("complementary", { name: "Réglages" });

When(
  "je clique deux fois sur {string} dans l'aperçu",
  async ({ page }, text: string) => {
    const target = preview(page)
      .locator("[data-ws-edit]")
      .getByText(text, { exact: true });
    await expect(target).toBeVisible();
    await target.dblclick();
  },
);

When("je tape {string} puis Entrée", async ({ page }, text: string) => {
  const editing = preview(page).locator("[contenteditable]");
  await expect(editing).toBeVisible();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
});

Then(
  "le champ {string} du bloc contient {string}",
  async ({ page }, label: string, value: string) => {
    await expect(settings(page).getByLabel(label, { exact: true })).toHaveValue(
      value,
    );
  },
);

When(
  "je sélectionne {string} dans la structure",
  async ({ page }, text: string) => {
    await page
      .getByRole("list", { name: "Structure" })
      .getByRole("button", { name: new RegExp(text) })
      .click();
    await expect(preview(page).locator("[data-ws-selected]")).toBeVisible();
  },
);

When("j'appuie sur Suppr", async ({ page }) => {
  await page.keyboard.press("Delete");
});

Then(
  "la structure ne contient plus {string}",
  async ({ page }, label: string) => {
    await expect(
      page.getByRole("list", { name: "Structure" }).getByText(label),
    ).toHaveCount(0);
  },
);

Then("la structure contient {string}", async ({ page }, label: string) => {
  await expect(
    page.getByRole("list", { name: "Structure" }).getByText(label).first(),
  ).toBeVisible();
});

When(
  "je glisse le bloc {string} sur {string} dans l'aperçu",
  async ({ page }, label: string, text: string) => {
    const source = page
      .getByRole("complementary", { name: "Blocs" })
      .getByRole("button", { name: label, exact: true });
    const target = preview(page).getByText(text, { exact: true });
    await expect(target).toBeVisible();
    await source.dragTo(target);
  },
);

When(
  "je choisis {string} pour {string}",
  async ({ page }, option: string, label: string) => {
    await settings(page)
      .getByLabel(label, { exact: true })
      .selectOption({ label: option });
  },
);

Then("l'aperçu contient des colonnes inversées", async ({ page }) => {
  await expect(
    preview(page).locator(".ws-columns--d-reverse.ws-columns--m-stack-reverse"),
  ).toBeVisible();
});

When(
  "je crée le type {string} avec le préfixe {string}",
  async ({ page }, name: string, prefix: string) => {
    await page.goto("/admin/types");
    await page.getByRole("button", { name: "Nouveau" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nom").fill(name);
    await dialog.getByLabel("Préfixe d'URL").fill(prefix);
    await dialog.getByRole("button", { name: "Créer" }).click();
    await expect(page.getByLabel("Nom du type")).toHaveValue(name);
  },
);

When(
  "je dépose le champ {string} et je le nomme {string}",
  async ({ page }, kind: string, label: string) => {
    await page
      .getByRole("complementary", { name: "Blocs" })
      .getByRole("button", { name: `Champ ${kind.toLowerCase()}`, exact: true })
      .click();
    await settings(page)
      .getByLabel("Nom du champ", { exact: true })
      .fill(label);
    await expect(preview(page).getByText(label, { exact: true })).toBeVisible();
  },
);

When("j'enregistre le type", async ({ page }) => {
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Type enregistré" }),
  ).toBeVisible();
});

When(
  "je remplis le champ {string} avec {string}",
  async ({ page }, label: string, value: string) => {
    await pickField(page, label);
    await page.getByLabel(label, { exact: true }).fill(value);
  },
);

Then(
  "le contenu est enregistré avec {string} pour {string}",
  async ({ page }, value: string, key: string) => {
    const id = page.url().split("/").pop();
    const res = await page.request.get(`/api/contents/${id}`);
    const { content } = await res.json();
    expect(content.data[key]).toBe(value);
  },
);

Then("le champ {string} n'est pas proposé", async ({ page }, label: string) => {
  await expect(settings(page).getByText(label, { exact: true })).toHaveCount(0);
});

Then("le champ {string} est proposé", async ({ page }, label: string) => {
  await expect(
    settings(page).getByText(label, { exact: true }).first(),
  ).toBeVisible();
});

When("j'ajoute le tag {string}", async ({ page }, tag: string) => {
  const input = page.getByLabel("Tags", { exact: true });
  await input.fill(tag);
  await input.press("Enter");
  await expect(
    page.getByRole("button", { name: `Retirer le tag ${tag}` }),
  ).toBeVisible();
});

When("je remplace l'adresse par {string}", async ({ page }, slug: string) => {
  const input = page.getByLabel("Adresse", { exact: true }).first();
  await input.fill(slug);
  await input.blur();
});

When("j'enregistre le contenu", async ({ page }) => {
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Enregistré" }).first(),
  ).toBeVisible();
});

Then(
  "l'adresse {string} redirige vers {string}",
  async ({ page }, from: string, to: string) => {
    const res = await page.request.get(from, { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(res.headers().location).toBe(to);
  },
);

When("j'ouvre puis ferme la médiathèque", async ({ page }) => {
  await page.getByRole("button", { name: "Couverture | choisir" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Fermer" })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
});

Then("je peux encore cliquer sur {string}", async ({ page }, name: string) => {
  await page
    .getByRole("button", { name, exact: true })
    .click({ timeout: 3000 });
});

When(
  "dans le champ {string}, j'insère un {string} avec le texte {string}",
  async ({ page }, field: string, item: string, text: string) => {
    await pickField(page, field);
    const editor = page.getByRole("textbox", { name: field, exact: true });
    await editor.click();
    await page.keyboard.type("/");
    await page.getByRole("option", { name: item }).click();
    await page.keyboard.type(text);
    await expect(editor.locator("h2")).toHaveText(text);
  },
);

/* Extensions, modales et éditeur enrichi */
const setI18n = async (
  page: import("@playwright/test").Page,
  enabled: boolean,
  codes: string[],
) => {
  const res = await page.request.put("/api/plugins", {
    data: {
      i18n: { enabled, languages: codes.map((code) => ({ code, label: "" })) },
    },
  });
  expect(res.ok()).toBe(true);
};

When(
  "j'active le multilingue avec la langue {string}",
  async ({ page }, code: string) => {
    await setI18n(page, false, []);
    await page.goto("/admin/plugins");
    await page.getByRole("switch", { name: "Activer" }).check();
    await expect(page.getByLabel("Code de langue")).toBeVisible();
    await page.getByLabel("Code de langue").fill(code);
    await page.getByRole("button", { name: "Ajouter" }).click();
    await expect(page.getByText("/en/…")).toBeVisible();
  },
);

When("je désactive le multilingue", async ({ page }) => {
  await setI18n(page, false, []);
});

When("je traduis le contenu en {string}", async ({ page }, code: string) => {
  const before = page.url();
  await page.getByRole("button", { name: `Traduire en ${code}` }).click();
  await expect(page).not.toHaveURL(before);
  await expect(
    page
      .getByRole("navigation", { name: "Langues" })
      .locator('[aria-current="true"]'),
  ).toHaveText(code);
});

When(
  "je supprime {string} depuis la liste",
  async ({ page }, title: string) => {
    await page.goto("/admin");
    await page.getByRole("button", { name: `Supprimer ${title}` }).click();
  },
);

Then("une modale demande {string}", async ({ page }, text: string) => {
  await expect(page.getByRole("dialog", { name: text })).toBeVisible();
});

When("je confirme avec {string}", async ({ page }, label: string) => {
  await page.getByRole("dialog").getByRole("button", { name: label }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});

Then("{string} n'est plus dans la liste", async ({ page }, title: string) => {
  await expect(
    page.getByRole("link", { name: title, exact: true }),
  ).toHaveCount(0);
});

When("je colle {string} dans le corps", async ({ page }, text: string) => {
  const body = page.getByRole("textbox", { name: "Corps" });
  await body.click();
  await body.evaluate((el, value) => {
    const data = new DataTransfer();
    data.setData("text/plain", value);
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, text);
});

Then("le corps contient une vidéo intégrée", async ({ page }) => {
  await expect(
    page
      .getByRole("textbox", { name: "Corps" })
      .locator("[data-youtube-video] iframe"),
  ).toHaveAttribute("src", /youtube-nocookie\.com\/embed\//);
});

Then(
  "le type {string} a le champ {string} de type {string}",
  async ({ page }, id: string, label: string, kind: string) => {
    const res = await page.request.get(`/api/types/${id}`);
    const { type } = await res.json();
    expect(
      type.fields.find((f: { label: string }) => f.label === label)?.type,
    ).toBe(kind);
  },
);

When(
  "je choisis la police {string} pour les titres",
  async ({ page }, font: string) => {
    await page
      .getByRole("group", { name: "Titres" })
      .getByText(font, { exact: true })
      .click();
  },
);

/* Révisions */
const confirmRestore = async (page: import("@playwright/test").Page) => {
  const confirm = page.getByRole("dialog", { name: /^Restaurer/ });
  await confirm.getByRole("button", { name: "Restaurer", exact: true }).click();
  await expect(confirm).toBeHidden();
};

When(
  "je restaure la version précédente depuis l'historique",
  async ({ page }) => {
    await page.getByRole("button", { name: "Historique" }).click();
    const history = page.getByRole("dialog", { name: "Historique" });
    await history
      .getByRole("button", { name: /^Restaurer la version/ })
      .first()
      .click();
    await confirmRestore(page);
    await expect(history).toBeHidden();
  },
);

Then("le titre du document est {string}", async ({ page }, title: string) => {
  await expect(
    page.getByRole("textbox", { name: "Titre", exact: true }),
  ).toHaveValue(title);
});

When(
  "je restaure {string} depuis les éléments supprimés",
  async ({ page }, title: string) => {
    await page.goto("/admin/data");
    await page
      .getByRole("region", { name: "Éléments supprimés" })
      .getByRole("button", { name: `Restaurer ${title}` })
      .click();
    await confirmRestore(page);
  },
);

Then(
  "{string} est de nouveau dans la liste",
  async ({ page }, title: string) => {
    await page.goto("/admin");
    await expect(
      page.getByRole("link", { name: title, exact: true }),
    ).toBeVisible();
  },
);

Then(
  "je vois la taille de {string} et de {string}",
  async ({ page }, a: string, b: string) => {
    const panel = page.getByRole("region", { name: "Stockage" });
    for (const label of [a, b])
      await expect(
        panel
          .locator("div", { has: page.getByText(label, { exact: true }) })
          .locator("dd"),
      ).toHaveText(/\d+(,\d)? (o|Ko|Mo|Go)/);
  },
);

/* Texte alternatif */
const noAltBadge = (page: import("@playwright/test").Page, name: string) =>
  page
    .locator(".ui-media", {
      has: page.getByRole("button", { name, exact: true }),
    })
    .getByText("Sans alt", { exact: true });

Then(
  "la vignette de {string} est marquée sans texte alternatif",
  async ({ page }, name: string) => {
    await expect(noAltBadge(page, name)).toBeVisible();
  },
);

Then(
  "la vignette de {string} n'est plus marquée sans texte alternatif",
  async ({ page }, name: string) => {
    await expect(noAltBadge(page, name)).toBeHidden();
  },
);

When(
  "je décris l'image {string} avec {string}",
  async ({ page }, name: string, alt: string) => {
    await page.getByRole("button", { name, exact: true }).click();
    const detail = page.getByRole("dialog", { name });
    await detail.getByLabel("Texte alternatif").fill(alt);
    await expect(detail.getByText("Enregistré", { exact: true })).toBeVisible();
    await detail.getByRole("button", { name: "Fermer" }).click();
    await expect(detail).toBeHidden();
  },
);

Then(
  "l'image de {string} est décrite par {string}",
  async ({ page }, path: string, alt: string) => {
    await page.goto(path);
    await expect(page.locator(".wsb-image img")).toHaveAttribute("alt", alt);
  },
);

Then("le menu {string} est ouvert", async ({ page }, name: string) => {
  await expect(page.getByLabel("Nom", { exact: true })).toHaveValue(name);
});

/* Mise en page des types : contenu ou liste */
When(
  "j'ouvre la mise en page du type {string}",
  async ({ page }, name: string) => {
    await page.goto("/admin/types");
    await page.getByRole("link", { name, exact: true }).click();
    await expect(page.getByLabel("Nom du type")).toHaveValue(name);
  },
);

When("je passe à la mise en page {string}", async ({ page }, mode: string) => {
  await page
    .getByRole("group", { name: "Mise en page" })
    .getByRole("button", { name: mode, exact: true })
    .click();
});
