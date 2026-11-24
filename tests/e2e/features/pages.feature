# language: fr
Fonctionnalité: Mise en page des types
  Un type se compose en blocs, avec un aperçu réel et un réglage mobile ;
  ses contenus reprennent cette mise en page.

  Contexte:
    Étant donné que je suis connecté en administrateur

  Scénario: Composer la mise en page d'un type
    Quand je crée le type "Services" avec le préfixe "services"
    Et j'ajoute le bloc "Titre"
    Et je saisis "Bienvenue chez nous" dans le champ "Texte"
    Alors l'aperçu affiche "Bienvenue chez nous"
    Quand j'enregistre le type
    Et je crée un contenu de type "Services"
    Et je titre le document "Conseil"
    Et je publie le contenu
    Alors la page publique "/services/conseil" affiche "Bienvenue chez nous"

  Scénario: Masquer un bloc sur mobile uniquement
    Quand je crée le type "Offres" avec le préfixe "offres"
    Et j'ajoute le bloc "Bouton"
    Et je passe l'éditeur en mobile
    Et j'ouvre l'onglet "Style"
    Et j'active l'option "Masquer"
    Alors l'aperçu indique "Mobile uniquement"
    Quand j'enregistre le type
    Et je crée un contenu de type "Offres"
    Et je titre le document "Été"
    Et je publie le contenu
    Alors la page publique "/offres/ete" masque un bloc sous 768 pixels

  Scénario: Modifier un texte directement dans l'aperçu
    Quand je crée le type "Équipes" avec le préfixe "equipes"
    Et j'ajoute le bloc "Titre"
    Et je clique deux fois sur "Titre" dans l'aperçu
    Et je tape "Écrit dans la page" puis Entrée
    Alors le champ "Texte" du bloc contient "Écrit dans la page"

  Scénario: Supprimer un bloc au clavier
    Quand je crée le type "Citations" avec le préfixe "citations"
    Et j'ajoute le bloc "Citation"
    Et je sélectionne "Citation" dans la structure
    Et j'appuie sur Suppr
    Alors la structure ne contient plus "Citation"

  Scénario: Glisser un bloc de la palette dans l'aperçu
    Quand je crée le type "Notes" avec le préfixe "notes"
    Et je glisse le bloc "Séparateur" sur "Titre d'exemple" dans l'aperçu
    Alors la structure contient "Séparateur"

  Scénario: Inverser l'ordre des colonnes
    Quand je crée le type "Duos" avec le préfixe "duos"
    Et j'ajoute le bloc "Colonnes"
    Et je choisis "Empilées, ordre inversé" pour "Sur mobile"
    Et je choisis "Inversé" pour "Ordre sur ordinateur"
    Alors l'aperçu contient des colonnes inversées
