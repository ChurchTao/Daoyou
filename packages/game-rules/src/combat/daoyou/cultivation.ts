import { DaoyouRule } from '@daoyou/game-content/combat/tuning';

/** 玩家和生灵均传入本游戏的修炼等级差，不提前取整等效等级。 */
export function cultivationModifiers(levelDifference: number) {
  const equivalent = levelDifference * DaoyouRule.cultivateLevelScale;
  return {
    damageRate: equivalent * DaoyouRule.cultivateRate,
    damageFlat: equivalent * DaoyouRule.cultivateFlat,
    sealPercent: equivalent * DaoyouRule.sealCultivateRate,
  };
}
