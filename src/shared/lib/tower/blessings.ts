import { TOWER_BLESSINGS_PACK } from './blessing-pack';
import type { TowerBlessingId } from './blessing-pack';
export { TOWER_BLESSING_IDS, type TowerBlessingId } from './blessing-pack';

export interface TowerBlessingDefinition {
  id: TowerBlessingId;
  name: string;
  description: string;
  maxStacks: number;
}

export function compileTowerBlessingDefinitions(pack = TOWER_BLESSINGS_PACK): Record<TowerBlessingId, TowerBlessingDefinition> {
  return Object.fromEntries(pack.blessings.map(b => {
    const percent = b.effect.perStack * 100;
    const description = b.effect.kind === 'recovery'
      ? `每场战斗前回复缺失${b.label}的 ${percent}%，可叠加至 ${b.maxStacks} 层。`
      : `战斗时${b.label}${b.effect.kind === 'allAttributes' ? '同步' : ''}提升 ${percent}%，可叠加至 ${b.maxStacks} 层。`;
    return [b.id, { id: b.id, name: b.name, description, maxStacks: b.maxStacks }];
  })) as Record<TowerBlessingId, TowerBlessingDefinition>;
}
export const TOWER_BLESSING_DEFINITIONS = compileTowerBlessingDefinitions();
export function getTowerBlessingDefinition(id: TowerBlessingId) {
  return TOWER_BLESSING_DEFINITIONS[id];
}
