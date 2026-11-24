# language: fr
Fonctionnalité: Médiathèque
  Une image envoyée est déclinée en plusieurs tailles et s'affiche partout.

  Contexte:
    Étant donné que je suis connecté en administrateur

  Scénario: Envoyer une image et l'afficher dans une page
    Quand j'envoie l'image "photo.jpg" dans la médiathèque
    Alors la vignette de "photo.jpg" s'affiche
    Quand je crée un contenu de type "Page"
    Et je renomme le contenu en "Galerie photo"
    Et j'ajoute le bloc "Image"
    Et je choisis l'image "photo.jpg" pour le champ "Image"
    Alors l'aperçu affiche une image chargée
    Quand je publie le contenu
    Alors la page publique "/galerie-photo" affiche une image webp chargée
