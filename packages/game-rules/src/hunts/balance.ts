import type { Attrs } from '@daoyou/combat-core/types';

// Hunt-specific, frozen realm curve. Never scale stats from the actual party's gear.
// Level 50 = 金丹中期; level 170 = 渡劫中期. Body training follows realm progression.
const cultivation = [15, 20, 30, 40, 45, 50, 60];
export function huntEnemyAttrs(
  level: number,
  role: 'boss' | 'elite' | 'normal',
  players: number,
): Attrs {
  const offset = Math.max(0, level - 50);
  const hp = Math.round(
    (role === 'boss'
      ? 6000 + offset * 150
      : role === 'elite'
        ? 3500 + offset * 55
        : 1400 + offset * 20) *
      (1 + (players - 2) * 0.4),
  );
  const output = 0.9 + (players - 2) * 0.12;
  const training =
    cultivation[Math.min(6, Math.max(0, Math.floor(offset / 20)))];
  return {
    hp,
    maxHp: hp,
    mp: 99999,
    maxMp: 99999,
    physicalAtk: Math.round(
      (250 + level * (role === 'boss' ? 8.5 : role === 'elite' ? 7 : 5.5)) *
        output,
    ),
    magicAtk: Math.round(
      (200 + level * (role === 'boss' ? 11 : role === 'elite' ? 10 : 8.5)) *
        output,
    ),
    physicalDef: Math.round((80 + level * 3) * (role === 'normal' ? 0.7 : 1)),
    magicDef: Math.round((100 + level * 4) * (role === 'normal' ? 0.7 : 1)),
    speed: Math.round(level * (role === 'boss' ? 3.5 : 2.7)),
    hit: 100 + level * 2,
    dodge: level,
    healPower: 0,
    critRate: 0,
    spellCritRate: 0,
    physicalFuryRate: 0,
    sealHit: level,
    sealResist: level,
    attackCultivate: training,
    defenseCultivate: training,
    spellCultivate: training,
    resistSpellCultivate: training,
  };
}
