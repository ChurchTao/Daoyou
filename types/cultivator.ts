// ===== 新一代修仙底层数据模型 =====

// 元素类型
export type ElementType =
  | '金'
  | '木'
  | '水'
  | '火'
  | '土'
  | '风'
  | '雷'
  | '冰'
  | '无';

// 基础属性
export interface Attributes {
  vitality: number; // 体魄：伤害减免、气血上限
  spirit: number; // 灵力：法术伤害、蓝量上限
  wisdom: number; // 悟性：暴击率、突破几率
  speed: number; // 速度：出手顺序、闪避率
  willpower: number; // 神识：状态抗性
}

// 灵根
export interface SpiritualRoot {
  element: ElementType;
  strength: number; // 0-100
}

// 先天命格 / 气运
export interface PreHeavenFateAttributeMod {
  vitality?: number;
  spirit?: number;
  wisdom?: number;
  speed?: number;
  willpower?: number;
}

export interface PreHeavenFate {
  name: string;
  type: '吉' | '凶';
  attribute_mod: PreHeavenFateAttributeMod;
  description?: string;
}

// 功法（被动）
export interface CultivationTechnique {
  name: string;
  bonus: Partial<Attributes>;
  required_realm: RealmType;
}

// 技能
export type SkillType = 'attack' | 'heal' | 'control' | 'debuff' | 'buff';

export type StatusEffect =
  | 'burn'
  | 'bleed'
  | 'poison'
  | 'stun'
  | 'silence'
  | 'root'
  | 'armor_up'
  | 'speed_up'
  | 'crit_rate_up'
  | 'armor_down';

export interface Skill {
  id?: string;
  name: string;
  type: SkillType;
  element: ElementType;
  power: number; // 30-150
  cost?: number;
  cooldown: number;
  effect?: StatusEffect;
  duration?: number;
  target_self?: boolean;
}

// 法宝 / 装备
export type EquipmentSlot = 'weapon' | 'armor' | 'accessory';

export interface ArtifactBonus {
  vitality?: number;
  spirit?: number;
  wisdom?: number;
  speed?: number;
  willpower?: number;
}

export type EffectType =
  | 'damage_bonus'
  | 'on_hit_add_effect'
  | 'on_use_cost_hp'
  | 'environment_change';

export interface BaseEffect {
  type: EffectType;
}

export interface DamageBonusEffect extends BaseEffect {
  type: 'damage_bonus';
  element: ElementType;
  bonus: number;
}

export interface OnHitAddEffect extends BaseEffect {
  type: 'on_hit_add_effect';
  effect: StatusEffect;
  chance: number; // 1-100
}

export interface OnUseCostHpEffect extends BaseEffect {
  type: 'on_use_cost_hp';
  amount: number;
}

export interface EnvironmentChangeEffect extends BaseEffect {
  type: 'environment_change';
  env_type: string;
}

export type ArtifactEffect =
  | DamageBonusEffect
  | OnHitAddEffect
  | OnUseCostHpEffect
  | EnvironmentChangeEffect;

export interface Artifact {
  id?: string;
  name: string;
  slot: EquipmentSlot;
  element: ElementType;
  bonus: ArtifactBonus;
  special_effects?: ArtifactEffect[];
  curses?: ArtifactEffect[];
}

// 消耗品
export type ConsumableType = 'heal' | 'buff' | 'revive' | 'breakthrough';

export interface TemporaryBonus extends Partial<Attributes> {
  duration: number;
}

export interface ConsumableEffect {
  hp_restore?: number;
  temporary_bonus?: TemporaryBonus;
}

export interface Consumable {
  name: string;
  type: ConsumableType;
  effect?: ConsumableEffect;
}

export interface Inventory {
  artifacts: Artifact[];
  consumables: Consumable[];
}

export interface EquippedItems {
  weapon: string | null;
  armor: string | null;
  accessory: string | null;
}

// 境界
export type RealmType =
  | '炼气'
  | '筑基'
  | '金丹'
  | '元婴'
  | '化神'
  | '炼虚'
  | '合体'
  | '大乘'
  | '渡劫';

export type RealmStage = '初期' | '中期' | '后期' | '圆满';

// 角色完整数据模型（与 basic.md 中 JSON Schema 对齐的运行时结构）
export interface Cultivator {
  id?: string;
  name: string;
  gender: '男' | '女' | '无';
  origin?: string;
  personality?: string;

  realm: RealmType;
  realm_stage: RealmStage;
  age: number;
  lifespan: number;

  attributes: Attributes;
  spiritual_roots: SpiritualRoot[];
  pre_heaven_fates: PreHeavenFate[];
  cultivations: CultivationTechnique[];
  skills: Skill[];

  inventory: Inventory;
  equipped: EquippedItems;

  max_skills: number;
  background?: string;

  // 兼容现有系统 & AI：保留原 prompt 入口（不进入战斗模型）
  prompt?: string;
}
