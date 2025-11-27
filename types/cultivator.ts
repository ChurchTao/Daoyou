/**
 * 战斗基础属性
 */
export interface BattleAttributes {
  vitality: number;
  spirit: number;
  wisdom: number;
  speed: number;
}

export type SkillType = 'attack' | 'heal' | 'control' | 'buff';
export type ElementType = '金' | '木' | '水' | '火' | '土' | '雷' | '无';

export interface Skill {
  name: string;
  type: SkillType;
  power: number; // 50~100
  element: ElementType;
  effects?: string[];
}

export interface EquipmentBonus {
  vitality?: number;
  spirit?: number;
  wisdom?: number;
  speed?: number;
  elementBoost?: Partial<Record<ElementType, number>>;
  skillPowerBoost?: number;
}

export interface Equipment {
  name: string;
  bonus?: EquipmentBonus;
}

export interface PreHeavenFate {
  name: string;
  type: '吉' | '凶';
  effect: string;
  description: string;
}

export interface ActiveEffect {
  name: string;
  type: string;
  value: number;
  duration: number;
  source: string;
}

export interface BattleProfile {
  maxHp: number;
  hp: number;
  attributes: BattleAttributes;
  skills: Skill[];
  equipment?: Equipment[];
  element?: ElementType;
  activeEffects?: ActiveEffect[];
}

export interface Cultivator {
  id: string;
  name: string;
  prompt: string;
  cultivationLevel: string;
  spiritRoot: string;
  appearance: string;
  backstory: string;
  gender?: string;
  origin?: string;
  personality?: string;
  preHeavenFates?: PreHeavenFate[];
  battleProfile?: BattleProfile;
}

export type CultivationLevelType =
  | '炼气'
  | '筑基'
  | '金丹'
  | '元婴'
  | '化神'
  | '炼虚'
  | '合体'
  | '大乘'
  | '渡劫';
