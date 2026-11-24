# language: fr
Fonctionnalité: Éditeur de pages
  Les pages se composent de blocs, avec un aperçu réel et un réglage mobile.

  Contexte:
    Étant donné que je suis connecté en administrateur

  Scénario: Composer et publier une page
    Quand je crée un contenu de type "Page"
    Et je renomme le contenu en "Nos services"
    Et j'ajoute le bloc "Titre"
    Et je saisis "Bienvenue chez nous" dans le champ "Texte"
    Alors l'aperçu affiche "Bienvenue chez nous"
    Quand je publie le contenu
    Alors la page publique "/nos-services" affiche "Bienvenue chez nous"

  Scénario: Masquer un bloc sur mobile uniquement
    Quand je crée un contenu de type "Page"
    Et j'ajoute le bloc "Bouton"
    Et je passe l'éditeur en mobile
    Et j'ouvre l'onglet "Style"
    Et j'active l'option "Masquer"
    Alors l'aperçu indique "Mobile uniquement"
    Quand je publie le contenu
    Alors la feuille de style publique masque ce bloc sous 768 pixels

  Scénario: Modifier un texte directement dans l'aperçu
    Quand je crée un contenu de type "Page"
    Et j'ajoute le bloc "Titre"
    Et je clique deux fois sur "Titre" dans l'aperçu
    Et je tape "Écrit dans la page" puis Entrée
    Alors le champ "Texte" du bloc contient "Écrit dans la page"

  Scénario: Supprimer un bloc au clavier
    Quand je crée un contenu de type "Page"
    Et j'ajoute le bloc "Citation"
    Et je sélectionne "Citation" dans la structure
    Et j'appuie sur Suppr
    Alors la structure ne contient plus "Citation"

  Scénario: Glisser un bloc de la palette dans l'aperçu
    Quand je crée un contenu de type "Page"
    Et je glisse le bloc "Séparateur" sur "Nouvelle page" dans l'aperçu
    Alors la structure contient "Séparateur"

  Scénario: Inverser l'ordre des colonnes
    Quand je crée un contenu de type "Page"
    Et j'ajoute le bloc "Colonnes"
    Et je choisis "Empilées, ordre inversé" pour "Sur mobile"
    Et je choisis "Inversé" pour "Ordre sur ordinateur"
    Alors l'aperçu contient des colonnes inversées
