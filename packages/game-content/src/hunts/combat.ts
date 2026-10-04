import type { SkillDef, StatusDef } from '@daoyou/combat-core/types';
import type { HuntBossId } from '@daoyou/game-domain/hunts';

export const mark = 'hunt.demon.mark';

const ward = 'hunt.beast.ward';

export const HUNT_SKILLS: SkillDef[] = [
  {
    id: 'hunt.minion.strike',
    name: '凶爪',
    tags: ['physical'],
    targeting: { side: 'enemy' },
    effects: [{ type: 'physicalHit', coeff: 0.6, defenseIgnore: 0.2 }],
  },
  {
    id: 'hunt.minion.bolt',
    name: '妖火',
    tags: ['spell'],
    targeting: { side: 'enemy' },
    effects: [
      { type: 'spellHit', power: 'level * 1.5', resultFactors: [0.65] },
    ],
  },
  {
    id: 'hunt.bolt',
    name: '妖焰',
    tags: ['spell'],
    targeting: { side: 'enemy' },
    effects: [{ type: 'spellHit', coeff: 1, power: 'level * 1.5' }],
  },
  {
    id: 'hunt.heal',
    name: '噬灵回元',
    tags: ['support'],
    targeting: { side: 'ally' },
    effects: [{ type: 'heal', power: 'target.maxHp * 0.12', fixedBase: true }],
  },
  {
    id: 'hunt.mark',
    name: '魔眼凝视',
    tags: ['support'],
    targeting: { side: 'enemy' },
    effects: [{ type: 'applyStatus', statusId: mark, duration: 2 }],
  },
  {
    id: 'hunt.slam',
    name: '摧山重击',
    tags: ['physical'],
    targeting: { side: 'enemy' },
    effects: [
      { type: 'physicalHit', coeff: 2.2 },
      { type: 'removeStatus', statusIds: [mark] },
    ],
  },
  {
    id: 'hunt.ward',
    name: '双生护体',
    tags: ['support'],
    targeting: { side: 'ally' },
    effects: [{ type: 'applyStatus', statusId: ward, duration: 2 }],
  },
  {
    id: 'hunt.strike',
    name: '破甲凶袭',
    tags: ['physical'],
    targeting: { side: 'enemy' },
    effects: [{ type: 'physicalHit', coeff: 0.9, defenseIgnore: 0.2 }],
  },
];

export const HUNT_STATUSES: StatusDef[] = [
  {
    id: mark,
    name: '魔眼标记·下回合重击',
    kind: mark,
    category: 'debuff',
    dispellable: false,
  },
  {
    id: ward,
    name: '双生护体',
    kind: ward,
    category: 'buff',
    damageTakenPhysical: 0.45,
    damageTakenSpell: 0.45,
  },
];

// Each formation reserves one boss and one elite; the remaining six are fodder.
export const formations: Record<
  HuntBossId,
  { elite: string; minions: [string, string] }
> = {
  heretic: { elite: '噬灵护法', minions: ['邪修刀客', '邪修术士'] },
  demon: { elite: '魔眼侍卫', minions: ['古魔爪牙', '魔焰侍从'] },
  beast: { elite: '伴生冥虎', minions: ['冥虎幼兽', '幽火虎妖'] },
  bloodPython: { elite: '血鳞蟒卫', minions: ['血鳞幼蟒', '赤焰蛇妖'] },
  ironTurtle: { elite: '负山鼋卫', minions: ['铁甲幼鼋', '寒水鼋妖'] },
  mistToad: { elite: '吐霞蟾将', minions: ['青皮蟾妖', '霞雾蟾妖'] },
  gildedCorpse: { elite: '守陵尸将', minions: ['披甲行尸', '幽火尸卒'] },
  shadowMarten: { elite: '逐风貂卫', minions: ['掠影幼貂', '月火貂妖'] },
};

export const HUNT_ENEMY_COUNT = 8;
