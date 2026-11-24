# TWSB — The Website Builder

<img src="public/twsb-mark.svg" alt="" width="72">

Constructeur de site léger, tout-en-un : pages composées par blocs, articles rédigés façon Notion, layouts, menus, identité et médiathèque. Une base SQLite et un dossier de médias : tout le site tient dans `/data` et s'exporte en un zip.

**Pile** : Bun · SolidStart 2 · Vite 8 · Nitro · SQLite (`bun:sqlite`) · Tiptap 3 · sharp.

## Démarrer

```bash
make dev              # app + Mailpit (Dockerfile.dev), http://localhost:3000/admin
                      # e-mails de test : http://localhost:8025
```

Sans Docker :

```bash
cp .env.example .env
bun install
bun run dev
```

Le premier administrateur est créé au démarrage à partir de `ADMIN_EMAIL` / `ADMIN_PASSWORD` si la base ne contient aucun compte. Les autres comptes sont invités depuis **Comptes** : un e-mail d'activation est envoyé via SMTP (sinon le lien s'affiche dans l'admin).

## Fonctionnalités

| Zone | Contenu |
| --- | --- |
| **Contenus** | Pages et articles au même endroit, filtres (type, statut, recherche, tri), duplication, brouillon / publication, aperçu du brouillon. Le titre et la description servent aussi au référencement. |
| **Éditeur de pages** | Palette de 30 blocs, structure en arbre (glisser-déposer), aperçu réel en iframe, inspecteur Contenu / Style, mode **mobile** avec surcharges dédiées, annuler / rétablir, `Ctrl+S`. |
| **Éditeur de documents** | Tiptap façon Notion : commande `/`, bulle de mise en forme, tâches, code, images de la médiathèque ou collées / glissées (envoyées automatiquement). Un lien YouTube collé devient une vidéo intégrée (sans cookie) ; un autre lien seul devient un aperçu (titre, image, description) affichable en URL, titre ou carte. |
| **Types** | Types de contenu personnalisés : préfixe d'URL, mode d'édition (document ou blocs), layout, **modèle** construit avec les blocs dynamiques (titre, couverture, date, corps). |
| **Layouts** | En-tête et pied communs, plusieurs layouts, un par type de contenu, en-tête fixe, fonds. |
| **Menus** | Liens libres ou vers un contenu, sous-menus. Rendu au choix : horizontal, pastilles, souligné, burger, vertical. Repli mobile accessible. |
| **Identité** | Nom, logo, favicon (généré en 32 px et 180 px), image de partage, couleurs, 9 polices embarquées (Inter, Manrope, Outfit, Space Grotesk, Playfair Display, Fraunces, Lora, Source Serif, JetBrains Mono — licence OFL, servies depuis `/fonts`, sans CDN) avec aperçu, arrondi, largeur, page d'accueil, modèle de titre. |
| **Médias** | Envoi multiple, variantes **webp** (320 → 1920 px) générées à l'envoi, `srcset` / `sizes` automatiques, orientation EXIF corrigée, métadonnées retirées, SVG actifs refusés. |
| **Extensions** | **Multilingue** à activer : langues secondaires, traduction d'un contenu en un clic, adresses `/en/…`, balises `hreflang`, sélecteur de langue (bloc « Langues »), listes et menus qui suivent la langue de la page. |
| **Données** | Export zip : `site.sqlite`, `media/`, et `static/` (site HTML prêt à servir). Import d'une archive. |

### Blocs

Structure : section, colonnes (1 à 4, ratios, empilement / inversion mobile), espace, séparateur.
Base : titre, texte riche, bouton, citation.
Média : image, galerie, vidéo (YouTube sans cookie, Vimeo, MP4), carte, intégration HTML (filtrée).
Sections : bannière (4 dispositions), atouts, cartes, chiffres, témoignages, FAQ, appel à l'action, coordonnées.
Site : logo, menu, réseaux, copyright.
Dynamique : liste de contenus ; dans les modèles, titre, date et auteur, couverture, corps.

Chaque bloc accepte un style par appareil : marges, fond (couleur, image, voile), couleur du texte, alignement, taille, largeur et hauteur, arrondi, ombre, masquage.

## Pourquoi SQLite, et faut-il générer des fichiers ?

Le site est lu bien plus qu'il n'est écrit, avec peu d'éditeurs simultanés : c'est le cas d'usage idéal de SQLite.

- **WAL activé** : les lectures ne bloquent jamais et ne sont jamais bloquées par une écriture. Une seule écriture à la fois, ce qui est sans effet avec quelques éditeurs.
- **En processus** : pas de réseau, une requête coûte quelques microsecondes.
- **Cache de rendu en mémoire** : chaque page publique rendue est gardée en HTML ; toute écriture (contenu, menu, layout, identité, média) incrémente une version qui invalide le cache.

Mesures locales sur le build de production (50 connexions simultanées) :

| Cas | Débit |
| --- | --- |
| Page servie depuis le cache | ~11 000 – 15 000 req/s |
| Rendu complet sans cache (requêtes SQLite comprises) | ~2 500 req/s |
| `/healthz` (coût du serveur seul) | ~14 500 req/s |

Une page en cache coûte autant que la route de santé : le serveur HTTP est la limite, pas la base. Générer des fichiers statiques que le back relirait serait **plus lent** que la mémoire et ajouterait un état à synchroniser. Les fichiers restent utiles pour un autre usage : l'export contient `static/`, déployable tel quel sur un CDN.

## Installer une version publiée

Chaque version publiée (tag `vX.Y.Z`) fournit :

- une **image Docker** : `ghcr.io/kazerlelutin/twsb:X.Y.Z` (et `:latest`) ;
- une **archive de build** prête à lancer, `twsb-vX.Y.Z.tar.gz`, avec ses empreintes (`checksums.txt`) dans la Release GitHub.

**CapRover** (port du conteneur `3000`, **Persistent Data** sur `/data`) :

- **Image publiée** (rien à construire) : dans l'app, *Deployment → Deploy via upload*, envoyer `twsb-caprover-vX.Y.Z.tar` de la Release. Il ne contient que le `captain-definition` qui pointe vers l'image GHCR.
- **Depuis les sources** : `bun run deploy:caprover` crée `dist/twsb-source-vX.Y.Z.tar` (sources commitées, `captain-definition` à la racine) à envoyer de la même façon, ou `caprover deploy` depuis le dépôt. Le déploiement depuis GitHub (webhook) fonctionne aussi.

CapRover exige `captain-definition` **à la racine** de l'archive : ne pas compresser le dossier du projet lui-même (`tar -czf x.tar.gz twsb/`).

**Docker** : `docker run -p 3000:3000 -v twsb-data:/data ghcr.io/kazerlelutin/twsb:latest`.

**Sans Docker** (Bun ≥ 1.3) :

```bash
tar -xzf twsb-vX.Y.Z.tar.gz && cd twsb
DATA_DIR=./data PORT=3000 bun launcher/launcher.mjs
```

**Paramétrer une fois installé** : aucune variable n'est obligatoire. Au premier lancement, la page de connexion propose l'**installation** (nom du site, administrateur). L'URL publique (déduite de l'adresse d'installation) et le SMTP se règlent ensuite dans **Système**. Une variable d'environnement définie l'emporte toujours sur le réglage de l'admin.

## Versions et mises à jour

- **Publier** : `bun run release patch|minor|major` met à jour `package.json`, commite et crée le tag ; `git push --follow-tags` déclenche la CI de release (vérifications, build, archive, image Docker).
- **CI** : `.github/workflows/ci.yml` (lint, types, tests, build, E2E) à chaque push ; `release.yml` sur les tags `v*.*.*` (le tag doit correspondre à `package.json`).
- **Détection** : **Système** interroge la dernière Release GitHub (cache six heures, bouton « Vérifier »). Dépôt privé : fournir `GITHUB_TOKEN` (lecture du dépôt).
- **Mise à jour** depuis l'admin :
  1. sauvegarde cohérente de la base (`/data/backups`) ;
  2. téléchargement de l'archive, contrôle de son empreinte sha256 ;
  3. installation dans `/data/releases/X.Y.Z`, puis redémarrage ;
  4. le **lanceur** essaie la nouvelle version : elle doit ouvrir la base (migrations jouées) et répondre sur `/healthz` sous 90 s. Sinon il **restaure la base** et relance l'ancienne version, et l'échec s'affiche dans Système.
- **Retour arrière** : chaque sauvegarde (avant mise à jour, ou manuelle) peut être restaurée depuis Système : la base revient à cet état, avec la version qui l'a produite.
- **Mise à jour de l'image** (`docker pull`) : même filet. Le lanceur sauvegarde la base avant de lancer une version jamais essayée, et revient en arrière si elle échoue.

Le lanceur (`launcher/`) est le point d'entrée de l'image : il choisit la version la plus récente entre celle de l'image et celle installée dans `/data`, en écartant les versions en échec.

Hors CapRover : `make prod` (voir `docker-compose.prod.yml`). L'image ne contient aucun état : sauvegarder `/data` suffit.

## Variables d'environnement

Toutes facultatives : les réglages se font aussi dans l'admin.

| Variable | Rôle |
| --- | --- |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Premier administrateur (sinon : écran d'installation). |
| `PUBLIC_URL` | URL publique : liens des e-mails, sitemap, canonical (sinon : réglage Système). |
| `DATA_DIR` | Dossier persistant (`/data` en conteneur). |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Envoi des e-mails (sinon : réglage Système). |
| `PORT` | Port HTTP (3000). |
| `GITHUB_TOKEN` | Lecture des Releases si le dépôt est privé. |
| `TWSB_UPDATE_REPO` | Dépôt des versions (`kazerlelutin/twsb`). |
| `TWSB_UPDATE_API` | API compatible GitHub (GitHub Enterprise, miroir). |
| `TWSB_HEALTH_TIMEOUT` | Délai d'essai d'une nouvelle version, en ms (90000). |

## Tests

```bash
bun run test        # unitaires, composants + axe, intégration API (Vitest)
bun run test:e2e    # scénarios Gherkin (playwright-bdd) + axe dans Chromium
bun run check       # lint (Biome), types, tests
```

- `src/**/*.test.ts(x)` : rendu des blocs, arbre de blocs, composants d'interface avec `vitest-axe`.
- `tests/integration` : API complète sur une base temporaire (auth, invitations, contenus, cache, médias, export / import).
- `tests/e2e/features/*.feature` : parcours en français (connexion, éditeur de pages, mobile, rédaction slash, identité, accessibilité WCAG 2.1 AA).

## Organisation

```
migrations/            schéma SQL versionné, appliqué au démarrage
src/server/            base, dépôts, auth, médias, rendu public, export, API
src/features/blocks/   catalogue des blocs et opérations sur l'arbre (isomorphe)
src/features/render/   rendu HTML pur du site public et de l'aperçu
src/features/builder/  éditeur visuel
src/features/editor/   éditeur Tiptap façon Notion
src/features/admin/    écrans d'administration
src/features/ui/       bibliothèque d'interface (charte Promeai)
src/routes/            routes fines : pages admin et API REST
src/middleware.ts      site public, médias, favicon, sitemap, robots
```

Le site public est du HTML rendu côté serveur, sans framework côté client : une feuille de style en ligne et un script de quelques lignes pour le menu mobile.

## Sécurité

Mots de passe en scrypt, sessions aléatoires stockées sous forme d'empreinte, cookies `HttpOnly` + `SameSite=Lax` (+ `Secure` derrière HTTPS), contrôle d'origine sur les écritures, HTML filtré à l'enregistrement (`sanitize-html`), URL des blocs filtrées (`javascript:`, `//`), chemins des médias verrouillés, aperçus de liens bornés (taille, durée, redirections) et refusant les adresses internes, au moins un administrateur actif garanti.
