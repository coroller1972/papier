export const SAMPLE_MARKDOWN = `# Processus de publication

Ce document décrit le flux de travail pour publier un article, depuis l'idée jusqu'à sa diffusion.

## Objectif

Assurer une publication de qualité, cohérente et traçable.

## Étapes

Le schéma ci-dessous illustre le processus :

\`\`\`mermaid
flowchart TD
  A[Idée] --> B[Rédaction]
  B --> C{Relecture}
  C -- Corrections --> B
  C -- OK --> D[Mise en page]
  D --> E
  E -- Rejeté --> B
  subgraph diffusion[ ]
    direction LR
    E[Validation] -- Approuvé --> F[Publication] --> G[Diffusion]
  end
  style diffusion fill:none,stroke:none
\`\`\`

## Notes

- Chaque étape doit être documentée.
- Les retours doivent être constructifs.
- La validation finale appartient au responsable éditorial.

> La qualité est l'affaire de tous.
`
