# TWSB — The Website Builder

<img src="public/twsb-mark.svg" alt="" width="72">

TWSB est un constructeur de sites web léger et autonome. On y conçoit la mise en page de chaque sorte de contenu (pages, articles, événements, produits…) avec un éditeur visuel en blocs. On rédige ensuite les contenus dans un formulaire simple, avec un éditeur de texte façon Notion.

Tout le site, base de données et médias compris, tient dans un seul dossier, `/data`. Une seule image Docker suffit pour le faire tourner, et il s'exporte en un fichier zip.

- [Les notions](#les-notions)
- [Installer](#installer)
- [Mettre à jour](#mettre-à-jour)
- [Configurer](#configurer)
- [Sauvegarder et migrer](#sauvegarder-et-migrer)
- [Développer](#développer)
- [Architecture](#architecture)

## Les notions

### Types : la mise en page

Un **type** décrit une sorte de contenu, par exemple *Page*, *Article* ou *Événement*. Chaque type a deux mises en page, à composer en blocs dans l'éditeur visuel. On passe de l'une à l'autre avec la bascule **Contenu | Liste**.

- **Contenu** : la page d'un contenu. On y place des blocs fixes (bannière, texte, boutons…) et des **champs à remplir** : texte court, texte riche, date, nombre, image, galerie, lien, liste de choix… Chaque champ posé et nommé devient une entrée du formulaire des contenus. Le bloc *Corps du contenu* ajoute un éditeur de texte libre.
- **Liste** : la page qui liste les contenus du type, par exemple `/blog` ou `/agenda`. Le bloc *Liste des contenus* règle :
  - l'affichage : grille ou liste, nombre de colonnes ;
  - le nombre de contenus par page et l'ordre ;
  - la pagination (`/blog/page/2`…).

  Les blocs posés à l'intérieur dessinent la **carte** répétée pour chaque contenu : couverture, date, titre, description, tags, valeur d'un champ.

Un type a aussi un préfixe d'adresse (`blog` → `/blog/mon-article`) et un layout.

### Contenus : remplir les champs

Un **contenu** reprend la mise en page de son type. On se contente de remplir :

- le titre et l'adresse ;
- les champs du type : on choisit le champ dans la colonne de droite, et sa saisie s'affiche dans la page. Les textes riches s'écrivent dans un éditeur façon Notion (commande `/`, bulle de mise en forme, images collées ou glissées, vidéos YouTube, aperçus de liens) ;
- les tags, la description (reprise par les moteurs de recherche), la couverture.

Un contenu est en brouillon tant qu'il n'est pas publié. Quand son adresse change, l'ancienne redirige vers la nouvelle (301).

### Et aussi

| Écran | Rôle |
| --- | --- |
| **Layouts** | En-tête et pied de page communs, composés en blocs. Un layout par type. |
| **Menus** | Liens libres ou vers des contenus, sous-menus. Affichés par le bloc *Menu* (horizontal, pastilles, souligné, burger, vertical). |
| **Identité** | Nom du site, logo, favicon, couleurs, polices (neuf polices embarquées, sans service externe), arrondi, largeur, page d'accueil, modèle de titre. |
| **Médias** | Images optimisées à l'envoi (variantes webp de 320 à 1920 px, chargement adapté à l'écran), texte alternatif, métadonnées retirées. |
| **Tags** | Classement transversal, avec une page par tag (`/tag/recettes`). |
| **Extensions** | Multilingue : langues secondaires, traduction d'un contenu en un clic, adresses `/en/…`, sélecteur de langue. |
| **Comptes** | Administrateurs et éditeurs, invitations par e-mail. |
| **Données** | Occupation du stockage, éléments supprimés restaurables, nettoyage des révisions, export et import du site. |
| **Système** | Version, mises à jour, sauvegardes, URL publique et SMTP. |

Chaque action laisse une **révision** : tout élément (contenu, type, layout, menu, tag, média, identité) a un historique, et chacune de ses versions peut être restaurée.

## Installer

L'application écoute sur le port **3000** et garde tout son état dans **`/data`**. Aucune variable d'environnement n'est obligatoire.

### CapRover

1. **Créer l'application**, par exemple `monsite`, puis cocher **Has Persistent Data**.
2. Dans **App Configs** :
   - **Persistent Directories** : *Path in App* = `/data`, avec un libellé au choix (`monsite-data`). Le chemin doit être **absolu**.
   - **Environmental Variables** : rien d'obligatoire. Ne pas définir `DATA_DIR` avec un chemin relatif.
3. Dans **HTTP Settings** : **Container HTTP Port** = `3000`. Activer HTTPS et le forçage si le domaine est prêt.
4. Dans **Deployment → Deploy via upload**, envoyer `twsb-caprover-vX.Y.Z.tar`. Ce fichier se trouve dans la [dernière Release](https://github.com/kazerlelutin/twsb/releases/latest). Il ne contient qu'un `captain-definition` qui pointe vers l'image publiée, si bien que CapRover n'a rien à compiler.
5. Ouvrir le site : il redirige vers **l'installation**.

Pour construire depuis les sources, `bun run deploy:caprover` produit `dist/twsb-source-vX.Y.Z.tar`, à envoyer de la même façon. On peut aussi déployer depuis le dépôt avec `caprover deploy` ou un webhook GitHub. CapRover exige le fichier `captain-definition` **à la racine** de l'archive envoyée.

### Docker

```bash
docker run -d --name monsite -p 3000:3000 -v monsite-data:/data \
  --restart unless-stopped ghcr.io/kazerlelutin/twsb:latest
```

### Sans Docker

Il faut Bun 1.3 ou plus récent, et `tar`.

```bash
tar -xzf twsb-vX.Y.Z.tar.gz
DATA_DIR=/srv/monsite PORT=3000 bun launcher/launcher.mjs
```

### Premier lancement

Tant qu'aucun compte n'existe, toutes les pages mènent à **`/admin/setup`**. On y donne le nom du site, puis l'e-mail et le mot de passe de l'administrateur. L'adresse utilisée pour l'installation devient l'URL publique du site ; on peut la changer dans **Système**.

Variante sans écran : définir `ADMIN_EMAIL` et `ADMIN_PASSWORD` avant le premier lancement.

## Mettre à jour

**Système** indique la version en service et la dernière publiée, avec ses nouveautés. **Mettre à jour** enchaîne :

1. une sauvegarde cohérente de la base, dans `/data/backups` ;
2. le téléchargement de la nouvelle version et le contrôle de son empreinte (sha256) ;
3. son installation dans `/data/releases`, puis un redémarrage ;
4. un essai de la nouvelle version : elle doit ouvrir la base, migrations jouées, et répondre en moins de 90 secondes. Si elle échoue, **la base est restaurée et l'ancienne version reprend la main**, et l'échec s'affiche dans Système.

**Retour arrière** : chaque sauvegarde de Système (avant une mise à jour, ou faite à la main) peut être restaurée. La base revient à cet état, avec la version qui l'a produite.

Déployer une image plus récente (Docker, CapRover) bénéficie du même filet : la base est sauvegardée avant le premier lancement de la nouvelle version, et restaurée si elle ne démarre pas.

> Les versions installées restent dans `/data/releases` (environ 40 Mo chacune) pour permettre le retour arrière. Les sauvegardes se suppriment depuis Système.

## Configurer

Tout se règle dans l'admin. Une variable d'environnement, si elle est définie, l'emporte sur le réglage de l'admin, qui l'indique alors.

| Variable | Rôle |
| --- | --- |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Premier administrateur, créé au démarrage si aucun compte n'existe. Sans elles, l'écran d'installation s'en charge. |
| `PUBLIC_URL` | URL publique, utilisée pour les liens des e-mails, le sitemap et les adresses canoniques. Sinon : **Système**. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Envoi des e-mails (invitations, mot de passe oublié). Sinon : **Système**. Sans SMTP, le lien d'invitation s'affiche dans l'admin. |
| `DATA_DIR` | Dossier des données, `/data` dans l'image. Doit être un chemin absolu. |
| `PORT` | Port HTTP (`3000`). |
| `TWSB_UPDATE_REPO` | Dépôt GitHub des versions (`kazerlelutin/twsb`). |
| `TWSB_UPDATE_API` | API compatible GitHub (GitHub Enterprise, miroir). |
| `GITHUB_TOKEN` | Accès aux Releases si le dépôt des versions est privé. |
| `TWSB_HEALTH_TIMEOUT` | Durée d'essai d'une nouvelle version, en millisecondes (`90000`). |

## Sauvegarder et migrer

- **Tout l'état** est dans `/data` : `site.sqlite` (contenus, réglages, comptes, révisions), `media/`, `backups/`, `releases/`. Copier ce dossier suffit.
- **Données → Exporter** télécharge un zip avec la base, les médias et une version statique du site (`static/`), déployable telle quelle sur n'importe quel hébergement de fichiers. **Importer** remplace le site entier par une archive.
- **Données → Nettoyer** supprime les révisions plus anciennes que X jours et compacte la base.

## Développer

```bash
make dev        # application + Mailpit dans Docker (Dockerfile.dev)
                # http://localhost:3000/admin, e-mails de test sur http://localhost:8025
```

Sans Docker :

```bash
bun install
cp .env.example .env
bun run dev
```

### Tests

```bash
bun run check       # lint (Biome), types, tests Vitest
bun run test:e2e    # scénarios Gherkin dans Chromium (playwright-bdd), accessibilité axe
```

| Dossier | Contenu |
| --- | --- |
| `src/**/*.test.ts(x)` | Rendu des blocs, arbre de blocs, composants d'interface (avec axe). |
| `tests/integration/` | API complète sur une base temporaire, mises à jour (faux GitHub), lanceur réel avec de fausses versions. |
| `tests/e2e/features/` | Parcours en français : connexion, mise en page des types, rédaction, médias, tags, révisions, accessibilité WCAG 2.1 AA. |

Les identifiants de test sont générés à chaque lancement (`tests/env.ts`).

### Publier une version

```bash
bun run release patch --push    # ou minor, major, 1.4.0
```

Le script met à jour `package.json`, commite, crée le tag `vX.Y.Z` et pousse. La CI de release (`.github/workflows/release.yml`) vérifie que le tag correspond à `package.json` et relance les contrôles. Elle publie ensuite :

- une Release GitHub avec `twsb-vX.Y.Z.tar.gz` (build prêt à lancer), `checksums.txt` et `twsb-caprover-vX.Y.Z.tar` ;
- l'image `ghcr.io/kazerlelutin/twsb:X.Y.Z` (et `:latest`).

À chaque push, `ci.yml` exécute lint, types, tests, build et E2E.

### Organisation du code

```
launcher/              lanceur de production : choix de version, essai, retour arrière
migrations/            schéma SQL versionné, appliqué au démarrage
scripts/               release, archives CapRover, version du build
src/middleware.ts      site public, médias, sitemap, robots
src/routes/            pages de l'admin et API REST
src/server/            base, dépôts, authentification, rendu public, médias, révisions, mises à jour
src/features/blocks/   catalogue des blocs, champs, opérations sur l'arbre
src/features/render/   rendu HTML du site public et de l'aperçu de l'éditeur
src/features/builder/  éditeur visuel
src/features/editor/   éditeur de texte (Tiptap)
src/features/admin/    écrans d'administration
src/features/ui/       composants d'interface
```

## Architecture

**Pile** : Bun, SolidStart 2 (admin en application monopage), Nitro, SQLite (`bun:sqlite`), Tiptap 3, sharp.

**Site public** : du HTML rendu côté serveur, sans framework côté client. Une feuille de style en ligne et quelques lignes de script pour le menu mobile. Chaque page rendue est gardée en mémoire. Toute écriture invalide ce cache, si bien qu'une page servie depuis le cache coûte autant qu'une route vide.

**Pourquoi SQLite** : un site est beaucoup plus lu qu'écrit, et compte peu d'éditeurs simultanés. Avec le journal WAL, les lectures ne bloquent jamais. La base tourne dans le processus, sans réseau, et une requête prend quelques microsecondes. Mesures sur le build de production, avec 50 connexions simultanées :

| Cas | Débit |
| --- | --- |
| Page servie depuis le cache | 11 000 à 15 000 req/s |
| Rendu complet, requêtes SQLite comprises | ~2 500 req/s |
| Route de santé seule | ~14 500 req/s |

Générer des fichiers statiques relus par le serveur serait plus lent que la mémoire, et ajouterait un état à synchroniser. L'export statique sert à un autre usage : héberger le site sur un CDN.

**Sécurité** :

- comptes : mots de passe hachés (scrypt), sessions stockées sous forme d'empreinte, cookies `HttpOnly` et `SameSite=Lax` (plus `Secure` derrière HTTPS), contrôle d'origine sur toutes les écritures ;
- contenus : HTML filtré à l'enregistrement, adresses des blocs filtrées (`javascript:`, `//`), chemins des médias verrouillés ;
- aperçus de liens : taille, durée et redirections bornées, adresses internes refusées ;
- mises à jour : archives vérifiées par empreinte ;
- administration : au moins un administrateur actif garanti.
