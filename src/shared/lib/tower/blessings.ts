import type { TowerBlessingId } from './blessing-pack';
import { TOWER_BLESSINGS_PACK } from './blessing-pack';
export { TOWER_BLESSING_IDS, type TowerBlessingId } from './blessing-pack';

export interface TowerBlessingDefinition {
  id: TowerBlessingId;
  name: string;
  icon: string;
  label: string;
  perStack: number;
  description: string;
  maxStacks: number;
}

export function compileTowerBlessingDefinitions(
  pack = TOWER_BLESSINGS_PACK,
): Record<TowerBlessingId, TowerBlessingDefinition> {
  return Object.fromEntries(
    pack.blessings.map((b) => {
      const percent = b.effect.perStack * 100;
      const description = `${b.label}提升 ${percent}%，最多 ${b.maxStacks} 次，同项加成相加。`;
      return [
        b.id,
        {
          id: b.id,
          name: b.name,
          icon: b.icon,
          label: b.label,
          perStack: b.effect.perStack,
          description,
          maxStacks: b.maxStacks,
        },
      ];
    }),
  ) as Record<TowerBlessingId, TowerBlessingDefinition>;
}
export const TOWER_BLESSING_DEFINITIONS = compileTowerBlessingDefinitions();
export function getTowerBlessingDefinition(id: TowerBlessingId) {
  return TOWER_BLESSING_DEFINITIONS[id];
}
