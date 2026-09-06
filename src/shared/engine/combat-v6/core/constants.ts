/**
 * 引擎层数值下限与缺省值。
 * 门派系数、波动区间属于 rules 插件，不要写进这里。
 */

/** 扣血/法伤结算后的最低伤害（端游有保底伤害） */
export const MIN_DAMAGE = 1

/** 单位气血下限；耗血技能也不会把自己打到 0 */
export const MIN_HP = 1

/** 气血上限至少为 1，避免除零 */
export const MIN_MAX_HP = 1

/** 未填写命中时的缺省命中（保证木桩对打必中） */
export const DEFAULT_HIT = 100

/** 选目标人数缺省 */
export const DEFAULT_TARGET_COUNT = 1

/** 多段攻击缺省段数 */
export const DEFAULT_HITS = 1

/** 状态承伤系数缺省：1 = 不修正 */
export const DEFAULT_DAMAGE_TAKEN = 1

/** 普通攻击的技能系数 */
export const NORMAL_ATTACK_COEFF = 1

/** 普攻在钩子/when 里的 skillId。不是内容表技能，不要拿去放 skills[]。 */
export const BUILTIN_SKILL_ID = {
  Attack: "attack",
} as const

/**
 * 属性名唯一列表。表达式绑定、默认属性和 Attrs 都从这里来，禁止再抄一份。
 */
export const ATTR_NAMES = [
  "hp",
  "maxHp",
  "mp",
  "maxMp",
  "physicalAtk", // 端游「伤害」
  "physicalDef", // 端游「防御」
  "magicAtk", // 面板法伤
  "magicDef", // 独立法防
  "healPower",
  "speed",
  "hit",
  "dodge",
  "critRate", // 必杀率 0–1
  "spellCritRate", // 法术暴击率 0–1
  "physicalFuryRate", // 物理狂暴率 0–1，先放大伤害再减防御
  "sealHit",
  "sealResist",
  "attackCultivate", // 攻法修炼
  "defenseCultivate", // 防御修炼
  "spellCultivate", // 法术修炼
  "resistSpellCultivate", // 抗法修炼
] as const

export type AttrName = (typeof ATTR_NAMES)[number]
