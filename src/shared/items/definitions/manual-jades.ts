import { CHARACTER_MANUALS_V1 } from '../../engine/combat-v6/manuals/content';

export const MANUAL_JADES = CHARACTER_MANUALS_V1.map((manual) => ({
  id: `jade.${manual.id}`,
  name: `${manual.name}玉简`,
  kind: 'manual_jade' as const,
  manualId: manual.id,
  stackLimit: 99,
}));
