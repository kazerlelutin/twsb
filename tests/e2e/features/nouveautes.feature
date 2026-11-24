# language: fr
Fonctionnalité: Extensions, modales et éditeur enrichi

  Contexte:
    Étant donné que je suis connecté en administrateur

  Scénario: Traduire un article grâce à l'extension Multilingue
    Quand j'active le multilingue avec la langue "en"
    Et je crée un contenu de type "Article"
    Et je titre le document "Bonjour"
    Et je publie le contenu
    Et je traduis le contenu en "EN"
    Et je titre le document "Hello"
    Et je publie le contenu
    Alors la page publique "/en/blog/hello" affiche "Hello"
    Et la page publique "/blog/bonjour" affiche "hreflang=\"en\""
    Et je désactive le multilingue

  Scénario: Supprimer un contenu après confirmation dans une modale
    Quand je crée un contenu de type "Article"
    Et je titre le document "À jeter"
    Et j'enregistre le contenu
    Et je supprime "À jeter" depuis la liste
    Alors une modale demande "Supprimer « À jeter » ?"
    Quand je confirme avec "Supprimer"
    Alors "À jeter" n'est plus dans la liste

  Scénario: Coller un lien YouTube intègre la vidéo
    Quand je crée un contenu de type "Article"
    Et je titre le document "Vidéo du mois"
    Et je colle "https://www.youtube.com/watch?v=dQw4w9WgXcQ" dans le corps
    Alors le corps contient une vidéo intégrée
    Quand je publie le contenu
    Alors la page publique "/blog/video-du-mois" affiche "youtube-nocookie.com/embed/dQw4w9WgXcQ"

  Scénario: Changer la saisie d'un champ depuis la colonne
    Quand je crée le type "Produits" avec le préfixe "produits"
    Et je dépose le champ "Texte court" et je le nomme "Prix"
    Et je choisis "Nombre" pour "Type de champ"
    Et j'enregistre le type
    Alors le type "produits" a le champ "Prix" de type "number"

  Scénario: Choisir une police embarquée
    Quand j'ouvre "/admin/identity"
    Et je choisis la police "Lora" pour les titres
    Et j'enregistre
    Alors la page publique "/" affiche "/fonts/lora.woff2"

  Scénario: La page Menus ouvre le premier menu
    Quand j'ouvre "/admin/menus"
    Alors le menu "Principal" est ouvert

  Scénario: La page Système montre la version et la configuration
    Quand j'ouvre "/admin/system"
    Alors je vois la version en service
    Et la page ne présente aucune violation d'accessibilité
