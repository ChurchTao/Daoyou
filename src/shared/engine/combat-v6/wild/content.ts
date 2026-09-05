import {
  ATTR_NAMES,
  EffectType,
  FormulaFamily,
  SkillTag,
  TargetSide,
  type Attrs,
  type SkillDef,
} from '../core/index.ts';

export const WILD_CONTENT_VERSION = 'daoyou_wild_encounter_content_v1';
export const WILD_REGION = {
  nodeId: 'SAT_TN_08',
  id: 'combat.wild.region.qingxi',
  name: '太岳山·青溪灵草坡',
  realmRequirement: '炼气',
  beastRealm: '启灵',
  minLevel: 5,
  maxLevel: 15,
} as const;
export const WILD_SPECIES = [
  {
    id: 'combat.wild.species.spirit-fox',
    name: '青灵狐',
    description: '溪畔启灵的青狐，以灵火护身。',
    role: '法术',
    skillIds: ['combat.wild.skill.spirit-flame'],
  },
  {
    id: 'combat.wild.species.rock-boar',
    name: '岩甲猪',
    description: '岩甲覆背，擅长正面迎敌。',
    role: '防御',
    skillIds: [],
  },
  {
    id: 'combat.wild.species.wind-wolf',
    name: '疾风狼',
    description: '穿行草坡的疾狼，迅捷而凶猛。',
    role: '物理',
    skillIds: [],
  },
] as const;
export const WILD_SKILLS: SkillDef[] = [
  {
    id: 'combat.wild.skill.spirit-flame',
    name: '灵火',
    tags: [SkillTag.Spell],
    formula: FormulaFamily.Spell,
    targeting: { side: TargetSide.Enemy, count: 1 },
    effects: [
      { type: EffectType.SpellHit, coeff: 0.85, power: '10 + skillLevel' },
    ],
  },
];

// Explicit level 5..15 rows: HP, MP, physical attack/defense, magic attack/defense, speed.
const PANELS = [
  [
    [150, 90, 20, 18, 35, 22, 22],
    [170, 100, 22, 20, 39, 25, 25],
    [190, 110, 24, 22, 43, 28, 28],
    [210, 120, 26, 24, 47, 31, 31],
    [230, 130, 28, 26, 51, 34, 34],
    [250, 140, 30, 28, 55, 37, 37],
    [270, 150, 32, 30, 59, 40, 40],
    [290, 160, 34, 32, 63, 43, 43],
    [310, 170, 36, 34, 67, 46, 46],
    [330, 180, 38, 36, 71, 49, 49],
    [350, 190, 40, 38, 75, 52, 52],
  ],
  [
    [220, 30, 30, 35, 10, 25, 12],
    [250, 35, 34, 39, 12, 28, 14],
    [280, 40, 38, 43, 14, 31, 16],
    [310, 45, 42, 47, 16, 34, 18],
    [340, 50, 46, 51, 18, 37, 20],
    [370, 55, 50, 55, 20, 40, 22],
    [400, 60, 54, 59, 22, 43, 24],
    [430, 65, 58, 63, 24, 46, 26],
    [460, 70, 62, 67, 26, 49, 28],
    [490, 75, 66, 71, 28, 52, 30],
    [520, 80, 70, 75, 30, 55, 32],
  ],
  [
    [160, 30, 38, 20, 10, 18, 35],
    [180, 35, 42, 23, 12, 20, 39],
    [200, 40, 46, 26, 14, 22, 43],
    [220, 45, 50, 29, 16, 24, 47],
    [240, 50, 54, 32, 18, 26, 51],
    [260, 55, 58, 35, 20, 28, 55],
    [280, 60, 62, 38, 22, 30, 59],
    [300, 65, 66, 41, 24, 32, 63],
    [320, 70, 70, 44, 26, 34, 67],
    [340, 75, 74, 47, 28, 36, 71],
    [360, 80, 78, 50, 30, 38, 75],
  ],
] as const;

export function wildPanel(speciesId: string, level: number): Attrs {
  const index = WILD_SPECIES.findIndex((s) => s.id === speciesId);
  const row = PANELS[index]?.[level - 5];
  if (!row || !Number.isInteger(level))
    throw new Error('INVALID_WILD_COMBATANT');
  const [maxHp, maxMp, physicalAtk, physicalDef, magicAtk, magicDef, speed] =
    row;
  return {
    hp: maxHp,
    maxHp,
    mp: maxMp,
    maxMp,
    physicalAtk,
    physicalDef,
    magicAtk,
    magicDef,
    speed,
    healPower: 0,
    hit: 100,
    dodge: 10,
    critRate: 0,
    spellCritRate: 0,
    physicalFuryRate: 0,
    sealHit: 0,
    sealResist: 0,
    attackCultivate: 0,
    defenseCultivate: 0,
    spellCultivate: 0,
    resistSpellCultivate: 0,
  };
}

export function validateWildContent(): string[] {
  const errors: string[] = [];
  const ids = [...WILD_SPECIES, ...WILD_SKILLS].map((x) => x.id);
  if (new Set(ids).size !== ids.length) errors.push('WILD_CONTENT_ID_CONFLICT');
  for (const species of WILD_SPECIES) {
    for (const id of species.skillIds)
      if (!WILD_SKILLS.some((s) => s.id === id))
        errors.push('UNKNOWN_WILD_SKILL');
    for (
      let level = WILD_REGION.minLevel;
      level <= WILD_REGION.maxLevel;
      level++
    ) {
      const attrs = wildPanel(species.id, level);
      if (
        ATTR_NAMES.some((key) => !Number.isFinite(attrs[key]) || attrs[key] < 0)
      )
        errors.push('INVALID_WILD_ATTRIBUTE');
    }
  }
  return errors;
}
