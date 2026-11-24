# language: fr
Fonctionnalité: Médiathèque
  Une image envoyée est déclinée en plusieurs tailles et s'affiche partout.

  Contexte:
    Étant donné que je suis connecté en administrateur

  Scénario: Envoyer une image et l'afficher dans une page
    Quand j'envoie l'image "photo.jpg" dans la médiathèque
    Alors la vignette de "photo.jpg" s'affiche
    Et la vignette de "photo.jpg" est marquée sans texte alternatif
    Quand je décris l'image "photo.jpg" avec "Un phare au crépuscule"
    Alors la vignette de "photo.jpg" n'est plus marquée sans texte alternatif
    Quand je crée le type "Galeries" avec le préfixe "galeries"
    Et j'ajoute le bloc "Image"
    Et je choisis l'image "photo.jpg" pour le champ "Image"
    Alors l'aperçu affiche une image chargée
    Quand j'enregistre le type
    Et je crée un contenu de type "Galeries"
    Et je titre le document "Galerie photo"
    Et je publie le contenu
    Alors la page publique "/galeries/galerie-photo" affiche une image webp chargée
    Et l'image de "/galeries/galerie-photo" est décrite par "Un phare au crépuscule"
