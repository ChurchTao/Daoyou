import type { BodyCultivationTrackKey } from '@daoyou/game-domain/condition';
import { BODY_CULTIVATION_PACK, BODY_CULTIVATION_TRACK_KEYS, bodyTrainingLevelCap } from '@daoyou/game-content/body-cultivation';
import { DaoyouRule } from '@daoyou/game-content/combat/tuning';

export type BodyCultivationEffectValues =
  | { kind: 'life'; hpPercent: number; healPower: number }
  | { kind: 'training'; trainingLevel: number; damagePercent: number; damageFlat: number; sealBasePercent: number | null };

/** Contribution against zero opposing cultivation; final combat uses the difference between both units. */
export function bodyCultivationEffectValues(key: BodyCultivationTrackKey, level: number, pack = BODY_CULTIVATION_PACK): BodyCultivationEffectValues {
  const safeLevel = Math.min(bodyTrainingLevelCap(pack), Math.max(0, Math.floor(level)));
  const benefit = pack.tracks[key].benefit;
  if (benefit.kind === 'life') return {
    kind: 'life',
    hpPercent: safeLevel * benefit.hpRatioPerLevel * 100,
    healPower: Math.floor(safeLevel / benefit.healLevelsPerPoint),
  };
  const trainingLevel = safeLevel * benefit.perLevel;
  const defending = benefit.attribute === 'defenseCultivate' || benefit.attribute === 'resistSpellCultivate';
  const difference = Math.max(DaoyouRule.damageCultivateDiffMin, Math.min(DaoyouRule.damageCultivateDiffMax, defending ? -trainingLevel : trainingLevel));
  return {
    kind: 'training', trainingLevel,
    damagePercent: Math.abs(difference * DaoyouRule.cultivateRate * 100),
    damageFlat: Math.abs(difference * DaoyouRule.cultivateFlat),
    sealBasePercent: benefit.attribute === 'spellCultivate' || benefit.attribute === 'resistSpellCultivate'
      ? DaoyouRule.sealCultivateWeight * Math.tanh(trainingLevel / DaoyouRule.sealCultivateScale)
      : null,
  };
}

export function bodyCultivationBenefits(levels: Record<BodyCultivationTrackKey, number>, maxHp: number, pack = BODY_CULTIVATION_PACK) {
  const training = { attackCultivate: 0, defenseCultivate: 0, spellCultivate: 0, resistSpellCultivate: 0 };
  for (const key of BODY_CULTIVATION_TRACK_KEYS) {
    const benefit = pack.tracks[key].benefit;
    if (benefit.kind === 'training') training[benefit.attribute] = levels[key] * benefit.perLevel;
  }
  const life = pack.tracks.qi_blood.benefit;
  return {
    ...training,
    lifeFoundationLevel: levels.qi_blood,
    maxHpBonus: Math.floor(maxHp * levels.qi_blood * life.hpRatioPerLevel),
    healPowerBonus: Math.floor(levels.qi_blood / life.healLevelsPerPoint),
  };
}

export function bodyCultivationEffectTexts(key: BodyCultivationTrackKey, level: number, pack = BODY_CULTIVATION_PACK): string[] {
  const effect = bodyCultivationEffectValues(key, level, pack);
  const number = (value: number) => Number(value.toFixed(1));
  if (effect.kind === 'life') return [
    `基础气血 +${number(effect.hpPercent)}%`,
    `固定治疗强度 +${effect.healPower}`,
  ];
  const benefit = pack.tracks[key].benefit;
  const reducing = benefit.kind === 'training' && (benefit.attribute === 'defenseCultivate' || benefit.attribute === 'resistSpellCultivate');
  const physical = benefit.kind === 'training' && (benefit.attribute === 'attackCultivate' || benefit.attribute === 'defenseCultivate');
  return [
    `${physical ? '物理' : '法术'}${reducing ? '减伤' : '增伤'} ${number(effect.damagePercent)}% + ${effect.damageFlat}（对手修炼为 0）`,
    ...(effect.sealBasePercent === null ? [] : [
      `${reducing ? '受封印命中基值 −' : '封印命中基值 +'}${number(effect.sealBasePercent)}%`,
    ]),
  ];
}
