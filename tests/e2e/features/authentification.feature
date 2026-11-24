# language: fr
Fonctionnalité: Authentification
  Le premier administrateur est créé depuis les variables d'environnement.

  Scénario: Connexion du premier administrateur
    Étant donné que je suis sur la page de connexion
    Quand je me connecte avec les identifiants de l'administrateur
    Alors je vois la liste des contenus

  Scénario: Mot de passe erroné
    Étant donné que je suis sur la page de connexion
    Quand je me connecte avec un mauvais mot de passe
    Alors je vois l'erreur "Identifiants incorrects."

  Scénario: Une page d'administration exige une connexion
    Quand j'ouvre "/admin/identity"
    Alors je suis redirigé vers la connexion
