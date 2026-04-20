/**
 * CreationNamingPolicy
 * 命名规则策略配置 — 控制 NamingRules 产生的产物默认名称
 */

/** 技能类产物命名配置 */
export const CREATION_SKILL_NAMING = {
  /** 无元素偏向时使用的默认前缀 */
  defaultPrefix: '玄灵',
  /** 技能名称后缀（接在元素前缀后面） */
  nameSuffix: '剑法',
} as const;

/** 法宝类产物命名配置 */
export const CREATION_ARTIFACT_NAMING = {
  /** 无槽位偏向时的默认法宝名称 */
  defaultName: '灵器',
  /** 有槽位偏向时的名称后缀 */
  slotSuffix: '法宝',
} as const;

/** 装备槽位显示名称映射（用于法宝命名，避免直接拼接英文枚举值） */
export const ARTIFACT_SLOT_DISPLAY_NAMES: Record<string, string> = {
  weapon: '战器',
  armor: '护甲',
  accessory: '玉佩',
};

/** 功法类产物命名配置 */
export const CREATION_GONGFA_NAMING = {
  /** 功法名称后缀（接在第一个材料名称后面） */
  nameSuffix: '心法',
  /** 无材料名称时的默认名称前缀 */
  defaultName: '玄灵心法',
} as const;

/** 通用描述模板 */
export const CREATION_DESCRIPTION_TEMPLATE = {
  /** 材料列表前导语 */
  materialListPrefix: '由',
  /** 材料列表后导语 */
  materialListSuffix: '炼制而成',
} as const;
