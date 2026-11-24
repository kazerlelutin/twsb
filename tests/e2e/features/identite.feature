# language: fr
Fonctionnalité: Identité du site
  Nom, couleurs et métadonnées s'appliquent à tout le site public.

  Contexte:
    Étant donné que je suis connecté en administrateur

  Scénario: Renommer le site
    Quand j'ouvre "/admin/identity"
    Et je remplace le champ "Nom" par "Atelier Lumière"
    Et j'enregistre
    Alors la page publique "/" a pour titre "Atelier Lumière"
