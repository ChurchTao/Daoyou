import {
  BattleAttributes,
  BattleProfile,
  Cultivator,
  ElementType,
  Skill,
} from '@/types/cultivator';

const ELEMENT_KEYWORDS: Record<ElementType, string[]> = {
  金: ['金', '剑', '锋', '铁', '金属'],
  木: ['木', '木灵', '草', '木系', '青'],
  水: ['水', '寒', '冰', '雪', '雨'],
  火: ['火', '炎', '焰', '炽', '赤'],
  土: ['土', '岩', '地', '黄', '砂'],
  雷: ['雷', '电', '雷霆', '霹雳'],
  无: [],
};

const ELEMENT_COUNTERPARTS: ElementType[] = [
  '金',
  '木',
  '水',
  '火',
  '土',
  '雷',
  '无',
];

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/**
 * 根据灵根推断元素属性
 */
export function mapSpiritRootToElement(spiritRoot: string): ElementType {
  const root = spiritRoot || '';
  for (const element of ELEMENT_COUNTERPARTS) {
    if (element === '无') continue;
    if (ELEMENT_KEYWORDS[element].some((keyword) => root.includes(keyword))) {
      return element;
    }
  }
  return '无';
}

/**
 * 随机数生成（包含端点）
 */
const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * 构造默认技能集合
 */
function buildDefaultSkills(name: string, element: ElementType): Skill[] {
  const primaryElement = element === '无' ? '火' : element;
  const attackSkill: Skill = {
    name: `${primaryElement}灵杀`,
    type: 'attack',
    power: randomInt(70, 90),
    element: primaryElement,
    effects:
      primaryElement === '雷'
        ? ['stun']
        : primaryElement === '火'
          ? ['burn']
          : [],
  };

  const secondarySkill: Skill = {
    name: `${name}心法`,
    type: 'buff',
    power: randomInt(40, 60),
    element: primaryElement,
    effects: ['speed_up'],
  };

  const healSkill: Skill = {
    name: '息壤养元',
    type: 'heal',
    power: randomInt(55, 70),
    element: '土',
    effects: ['heal'],
  };

  return [attackSkill, secondarySkill, healSkill];
}

/**
 * 从人物文本信息创建默认战斗属性
 */
const LEVEL_BASE_MAP: { keyword: string; base: number }[] = [
  { keyword: '渡劫', base: 95 },
  { keyword: '大乘', base: 92 },
  { keyword: '合体', base: 90 },
  { keyword: '炼虚', base: 88 },
  { keyword: '化神', base: 86 },
  { keyword: '元婴', base: 84 },
  { keyword: '金丹', base: 78 },
  { keyword: '筑基', base: 70 },
  { keyword: '炼气', base: 62 },
];

function deriveBaseFromLevel(level: string): number {
  const normalized = level || '';
  const entry = LEVEL_BASE_MAP.find(({ keyword }) =>
    normalized.includes(keyword),
  );
  return entry?.base ?? 65;
}

export function generateDefaultBattleProfile(
  cultivator: Cultivator,
  seed?: Partial<BattleAttributes>,
): BattleProfile {
  const element = mapSpiritRootToElement(cultivator.spiritRoot);
  const base = deriveBaseFromLevel(cultivator.cultivationLevel);

  const vitality = clamp(seed?.vitality ?? base + randomInt(-5, 5), 55, 100);
  const spirit = clamp(seed?.spirit ?? base + randomInt(0, 10), 55, 100);
  const wisdom = clamp(seed?.wisdom ?? base + randomInt(-10, 8), 55, 100);
  const speed = clamp(seed?.speed ?? base + randomInt(-5, 5), 55, 100);

  const attributes: BattleAttributes = {
    vitality,
    spirit,
    wisdom,
    speed,
  };

  const maxHp = Math.round(80 + vitality * 0.5);

  return {
    maxHp,
    hp: maxHp,
    attributes,
    element,
    skills: buildDefaultSkills(cultivator.name, element),
    equipment: [
      {
        name: '灵纹戒',
        bonus: {
          spirit: 5,
          elementBoost: element !== '无' ? { [element]: 0.1 } : undefined,
        },
      },
    ],
  };
}

/**
 * 确保角色拥有战斗属性
 */
export function ensureBattleProfile(cultivator: Cultivator): BattleProfile {
  if (!cultivator.battleProfile) {
    cultivator.battleProfile = generateDefaultBattleProfile(cultivator);
  }
  // 返回深拷贝，防止外部修改原始数据
  return cloneBattleProfile(cultivator.battleProfile);
}

export function cloneBattleProfile(profile: BattleProfile): BattleProfile {
  return JSON.parse(JSON.stringify(profile));
}
