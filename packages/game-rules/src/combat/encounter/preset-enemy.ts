import { earlyBaselines } from '@daoyou/game-content/combat/early-baselines';
import { getLevelRealmStage, getRealmStageLevel } from '@daoyou/game-domain/progression';

import { TOWER_ENCOUNTER_PACK } from '@daoyou/game-content/tower';

export type PresetEnemyKind = 'normal' | 'elite' | 'boss';

/** A whole-encounter budget; multiple enemies split both health and output. */
export function presetEnemyAttrs(
  level: number,
  kind: PresetEnemyKind,
  count = 1,
) {
  if (
    !Number.isInteger(level) ||
    level < 1 ||
    level > 180 ||
    !Number.isInteger(count) ||
    count < 1
  )
    throw new Error('预设敌人等级或数量无效');
  const { realm } = getLevelRealmStage(level);
  const baseline =
    realm === '炼气' || realm === '筑基'
      ? earlyBaselines[realm]
      : TOWER_ENCOUNTER_PACK.baselines[realm];
  const middle = getRealmStageLevel(realm, '中期');
  const stageScale = 1 + (level - middle) * 0.02;
  const budget = TOWER_ENCOUNTER_PACK.scaling.types[kind];
  const maxHp = Math.round(
    (baseline.damagePerRound * budget.rounds * stageScale) / count,
  );
  const physicalAtk = Math.round(
    baseline.referencePhysicalDef +
      ((baseline.physicalAtk - baseline.referencePhysicalDef) *
        budget.output *
        stageScale) /
        count,
  );
  const magicAtk = Math.round(
    baseline.referenceMagicDef +
      ((baseline.magicAtk - baseline.referenceMagicDef) *
        budget.output *
        stageScale) /
        count,
  );
  return {
    hp: maxHp,
    maxHp,
    mp: 100 + level * 10,
    maxMp: 100 + level * 10,
    physicalAtk,
    magicAtk,
    physicalDef: Math.round(baseline.physicalDef * stageScale),
    magicDef: Math.round(baseline.magicDef * stageScale),
    speed: Math.round(baseline.speed * stageScale),
    hit: baseline.hit,
    dodge: baseline.dodge,
  };
}
