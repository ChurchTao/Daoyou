import type { RealmStage, RealmType } from '@daoyou/constants/realms';
import { DUNGEON_ENEMY_PACK } from '@daoyou/game-content/combat/dungeon';
import type { DungeonTemplate } from '@daoyou/game-domain/combat/challenges';
import type { DungeonDifficultyTier } from '@daoyou/game-domain/dungeon';

export interface DungeonEnemyAttrInput {
  realm: RealmType;
  stage: RealmStage;
  tier: DungeonDifficultyTier;
  template: DungeonTemplate;
}

function feel(scale: number, intensity: number) {
  return 1 + (scale - 1) * intensity;
}

/** 整场预算。精英按模板人数平分气血和攻击超出参照防御的部分，双防不拆。 */
export function dungeonEnemyAttrs(input: DungeonEnemyAttrInput) {
  const baseline = DUNGEON_ENEMY_PACK.baselines[input.realm];
  const intensity = DUNGEON_ENEMY_PACK.intensity[input.realm];
  if (!baseline || intensity === undefined) throw new Error('云游境界无效');
  const kind = DUNGEON_ENEMY_PACK.kinds[input.template];
  const count = kind.count;
  const stage = DUNGEON_ENEMY_PACK.stages[input.stage];
  const tier = DUNGEON_ENEMY_PACK.tiers[input.tier];
  const hpScale =
    feel(stage, intensity) * feel(tier, intensity) * feel(kind.hp, intensity);
  const outputScale =
    feel(stage, intensity) *
    feel(tier, intensity) *
    feel(kind.output, intensity);
  const defenseScale = feel(stage, intensity * DUNGEON_ENEMY_PACK.defenseWeight);
  const maxHp = Math.max(1, Math.round((baseline.maxHp * hpScale) / count));
  return {
    hp: maxHp,
    maxHp,
    physicalAtk: Math.max(
      1,
      Math.round(
        baseline.referencePhysicalDef +
          ((baseline.physicalAtk - baseline.referencePhysicalDef) *
            outputScale) /
            count,
      ),
    ),
    magicAtk: Math.max(
      1,
      Math.round(
        baseline.referenceMagicDef +
          ((baseline.magicAtk - baseline.referenceMagicDef) * outputScale) /
            count,
      ),
    ),
    physicalDef: Math.max(1, Math.round(baseline.physicalDef * defenseScale)),
    magicDef: Math.max(1, Math.round(baseline.magicDef * defenseScale)),
    speed: baseline.speed,
    hit: baseline.hit,
    dodge: baseline.dodge,
  };
}
