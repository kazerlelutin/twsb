# language: fr
Fonctionnalité: Tags et adresses
  Les contenus se classent par tags ; leur adresse se modifie sans casser les liens.

  Contexte:
    Étant donné que je suis connecté en administrateur

  Scénario: Taguer un article et retrouver sa page de tag
    Quand je crée un contenu de type "Article"
    Et je titre le document "Soupe de saison"
    Et j'ajoute le tag "Recettes"
    Et je publie le contenu
    Alors la page publique "/tag/recettes" affiche "Soupe de saison"

  Scénario: Changer l'adresse d'un contenu publié
    Quand je crée un contenu de type "Article"
    Et je titre le document "Ancien titre"
    Et je publie le contenu
    Et je remplace l'adresse par "nouvelle-adresse"
    Et j'enregistre le contenu
    Alors l'adresse "/blog/ancien-titre" redirige vers "/blog/nouvelle-adresse"

  Scénario: Une modale fermée ne bloque pas la page
    Quand je crée un contenu de type "Article"
    Et j'ouvre puis ferme la médiathèque
    Alors je peux encore cliquer sur "Enregistrer"
