import type { CombatV6TrainingPlayerInput } from '@shared/engine/combat-v6/encounter';
import { combatCharacterLevel } from '@shared/engine/combat-v6/projection/character-level';
import {
  createTowerHost,
  TowerHost,
} from '@shared/engine/combat-v6/tower/host';
import { hashTowerSeed } from '@shared/lib/tower/helpers';
import { getTowerSeasonMeta } from '@shared/lib/tower/season';
import { createTowerWeek } from '@shared/lib/tower/weekly';
import {
  buildInfiniteTowerEnemySeed,
  resolveInfiniteTowerFloor,
} from './index';

// Permanent progression uses a fixed content rotation, independent of weekly resets.
const week = createTowerWeek(
  getTowerSeasonMeta(new Date('2026-09-14T00:00:00Z')),
);

export function createInfiniteTowerHost(
  player: CombatV6TrainingPlayerInput,
  floor: number,
  cultivatorId: string,
) {
  const rule = resolveInfiniteTowerFloor(floor);
  // Upstream tower starts at 金丹; map the first two realm bands by character level.
  const referenceRealm =
    rule.realm === '炼气' || rule.realm === '筑基' ? '金丹' : rule.realm;
  const initial = createTowerHost(
    player,
    referenceRealm,
    rule.localFloor,
    {},
    week,
    hashTowerSeed(buildInfiniteTowerEnemySeed({ cultivatorId, floor })),
  );
  const scale =
    (rule.endlessAttributeMultiplier *
      combatCharacterLevel(rule.realm, rule.realmStage)) /
    combatCharacterLevel(referenceRealm, rule.realmStage);
  if (scale === 1) return initial;
  const source = initial.runtimeSnapshot();
  for (const unit of source.input.units) {
    if (unit.side !== 1) continue;
    unit.level = combatCharacterLevel(rule.realm, rule.realmStage);
    for (const key of [
      'hp',
      'maxHp',
      'mp',
      'maxMp',
      'physicalAtk',
      'physicalDef',
      'magicAtk',
      'magicDef',
      'speed',
    ] as const) {
      const value = unit.attrs[key];
      if (typeof value === 'number')
        unit.attrs[key] = Math.max(1, Math.round(value * scale));
    }
  }
  return new TowerHost(source);
}
