# language: fr
Fonctionnalité: Révisions
  Chaque action laisse une révision : on peut revenir à une version
  ou restaurer un élément supprimé ; Données montre l'occupation du stockage.

  Contexte:
    Étant donné que je suis connecté en administrateur

  Scénario: Revenir à une version précédente d'un contenu
    Quand je crée un contenu de type "Article"
    Et je titre le document "Première version"
    Et j'enregistre le contenu
    Et je titre le document "Seconde version"
    Et j'enregistre le contenu
    Et je restaure la version précédente depuis l'historique
    Alors le titre du document est "Première version"

  Scénario: Restaurer un contenu supprimé depuis Données
    Quand je crée un contenu de type "Article"
    Et je titre le document "À sauver"
    Et j'enregistre le contenu
    Et je supprime "À sauver" depuis la liste
    Et je confirme avec "Supprimer"
    Et je restaure "À sauver" depuis les éléments supprimés
    Alors "À sauver" est de nouveau dans la liste

  Scénario: Voir la taille de la base et des médias
    Quand j'ouvre "/admin/data"
    Alors je vois la taille de "Base" et de "Médias"
