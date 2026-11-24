# language: fr
Fonctionnalité: Rédaction façon Notion
  Les articles s'écrivent dans un éditeur de texte riche avec la commande « / ».

  Contexte:
    Étant donné que je suis connecté en administrateur

  Scénario: Rédiger un article avec la commande slash
    Quand je crée un contenu de type "Article"
    Et je titre le document "Carnet de route"
    Et j'insère un "Titre 2" via la commande slash avec le texte "Étape un"
    Et je publie le contenu
    Alors la page publique "/blog/carnet-de-route" affiche "Étape un"
    Et la page publique "/blog" affiche "Carnet de route"

  Scénario: Filtrer les contenus
    Quand je filtre les contenus par type "Article"
    Alors je vois "Premier article" dans la liste
    Et je ne vois pas "Accueil" dans la liste
