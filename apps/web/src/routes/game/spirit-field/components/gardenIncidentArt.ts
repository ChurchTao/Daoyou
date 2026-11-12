import type { SpiritGardenIncidentKind } from '@daoyou/game-domain/spirit-field';

export const GARDEN_INCIDENT_ART = {
  pests: '/assets/spirit-garden/incidents/pests-v1.webp',
  beast: '/assets/spirit-garden/incidents/beast-v1.webp',
  mutation: '/assets/spirit-garden/incidents/mutation-v1.webp',
} satisfies Record<SpiritGardenIncidentKind, string>;
