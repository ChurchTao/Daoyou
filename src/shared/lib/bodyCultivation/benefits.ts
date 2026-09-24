import type { BodyCultivationTrackKey } from '@shared/types/condition';
import { BODY_CULTIVATION_PACK, BODY_CULTIVATION_TRACK_KEYS } from './pack';

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
  const safeLevel = Math.max(0, Math.floor(level));
  const track = pack.tracks[key];
  if (track.benefit.kind === 'training') return [`${track.layerName} Lv.${safeLevel * track.benefit.perLevel}`];
  return [
    `裸身气血 +${Number((safeLevel * (track.benefit.hpRatioPerLevel * 100)).toFixed(1))}%`,
    `固定治疗强度 +${Math.floor(safeLevel / track.benefit.healLevelsPerPoint)}`,
  ];
}
