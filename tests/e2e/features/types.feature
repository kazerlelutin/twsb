# language: fr
Fonctionnalité: Types de contenu à champs
  Dans le type, on dépose et nomme des champs dans l'éditeur visuel.
  Dans chaque contenu, on remplit ces champs comme un formulaire.

  Contexte:
    Étant donné que je suis connecté en administrateur

  Scénario: Créer un type avec des champs et le remplir
    Quand je crée le type "Événements" avec le préfixe "agenda"
    Et je dépose le champ "Texte court" et je le nomme "Lieu"
    Et je dépose le champ "Date" et je le nomme "Date de l'événement"
    Et j'enregistre le type
    Et je crée un contenu de type "Événements"
    Et je titre le document "Concert d'hiver"
    Et je remplis le champ "Lieu" avec "Salle des fêtes"
    Et je publie le contenu
    Alors le contenu est enregistré avec "Salle des fêtes" pour "lieu"

  Scénario: Les champs inutiles sont masqués
    Quand je crée le type "Vitrines" avec le préfixe "vitrines"
    Et j'ajoute le bloc "Bannière"
    Alors le champ "Image" n'est pas proposé
    Quand je choisis "Image à droite" pour "Disposition"
    Alors le champ "Image" est proposé

  Scénario: Rédiger un champ texte riche comme dans Notion
    Quand je crée le type "Ateliers" avec le préfixe "ateliers"
    Et je dépose le champ "Texte riche" et je le nomme "Programme"
    Et j'enregistre le type
    Et je crée un contenu de type "Ateliers"
    Et je titre le document "Atelier céramique"
    Et dans le champ "Programme", j'insère un "Titre 2" avec le texte "Matin"
    Et je publie le contenu
    Alors la page publique "/ateliers/atelier-ceramique" affiche "<h2>Matin</h2>"

  Scénario: Composer la page de liste d'un type
    Quand j'ouvre la mise en page du type "Article"
    Et je passe à la mise en page "Liste"
    Alors l'aperçu affiche "Premier article"
    Quand je sélectionne "Liste des contenus" dans la structure
    Et je choisis "Liste" pour "Affichage"
    Et j'enregistre le type
    Alors la page publique "/blog" affiche "ws-entries--list"
