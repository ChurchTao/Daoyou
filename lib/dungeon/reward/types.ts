/**
 * 副本奖励系统 - 类型定义
 *
 * 采用"AI创意 + 程序数值化"的混合架构：
 * - AI 生成奖励蓝图（名称、描述、方向性标签）
 * - 程序根据境界门槛和评级生成具体数值
 */

/**
 * 方向性标签 - AI可以使用的修饰词
 * 程序会将这些标签映射为具体的游戏属性
 */
export type DirectionTag =
  // 属性方向
  | 'increase_vitality' // 增加体魄
  | 'increase_spirit' // 增加灵力
  | 'increase_wisdom' // 增加悟性
  | 'increase_speed' // 增加身法
  | 'increase_willpower' // 增加神识
  // 元素亲和
  | 'fire_affinity' // 火属性
  | 'water_affinity' // 水属性
  | 'wood_affinity' // 木属性
  | 'metal_affinity' // 金属性
  | 'earth_affinity' // 土属性
  | 'thunder_affinity' // 雷属性
  | 'ice_affinity' // 冰属性
  | 'wind_affinity' // 风属性
  // 特殊效果
  | 'critical_boost' // 增加暴击
  | 'defense_boost' // 增加防御
  | 'healing_boost' // 增加治疗
  | 'lifespan_boost' // 增加寿元
  | 'cultivation_boost'; // 增加修为速度

/**
 * 奖励类型 - 限定为资源引擎支持的类型
 */
export type RewardType =
  | 'spirit_stones'
  | 'material'
  | 'artifact'
  | 'consumable'
  | 'cultivation_exp'
  | 'comprehension_insight';

/**
 * 品质提示
 */
export type QualityHint = 'lower' | 'medium' | 'upper';

/**
 * AI生成的奖励蓝图 - 只包含创意内容，不包含数值
 */
export interface RewardBlueprint {
  /** 奖励类型 - 限定为资源引擎支持的类型 */
  type: RewardType;

  /** 物品名称 (AI创意) */
  name: string;

  /** 物品描述 (AI创意) */
  description: string;

  /** 方向性标签 - 用于程序解析为具体属性 */
  direction_tags: DirectionTag[];

  /** 品质等级提示 */
  quality_hint: QualityHint;
}

/**
 * 数值范围配置
 */
export interface ValueRange {
  min: number;
  max: number;
}

/**
 * 境界奖励范围配置
 */
export interface RewardRangeConfig {
  /** 灵石数量范围 */
  spirit_stones: ValueRange;
  /** 材料价值范围 */
  material_price: ValueRange;
  /** 法宝属性加成范围 */
  artifact_bonus: ValueRange;
  /** 消耗品效果范围 */
  consumable_effect: ValueRange;
  /** 修为值范围 */
  cultivation_exp: ValueRange;
  /** 感悟值范围 */
  comprehension_insight: ValueRange;
}
