# language: fr
Fonctionnalité: Accessibilité
  Le site public et l'administration respectent les règles WCAG A et AA vérifiables automatiquement.

  Scénario: Le site public est accessible
    Quand j'ouvre "/"
    Alors la page ne présente aucune violation d'accessibilité

  Scénario: Un article public est accessible
    Quand j'ouvre "/blog/premier-article"
    Alors la page ne présente aucune violation d'accessibilité

  Scénario: La connexion est accessible
    Quand j'ouvre "/admin/login"
    Alors la page ne présente aucune violation d'accessibilité

  Scénario: La liste des contenus est accessible
    Étant donné que je suis connecté en administrateur
    Alors la page ne présente aucune violation d'accessibilité

  Scénario: Le menu public se replie sur mobile
    Étant donné un écran de téléphone
    Quand j'ouvre "/"
    Et j'ouvre le menu du site
    Alors le lien "Blog" est visible
    Quand j'appuie sur Échap
    Alors le lien "Blog" est masqué
