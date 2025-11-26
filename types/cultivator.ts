/**
 * 修仙者角色数据模型
 * 对应 README.md 第二阶段的数据结构设计
 */

export interface Cultivator {
  id: string; // UUID
  name: string; // 角色名（可 AI 生成）
  prompt: string; // 用户原始提示词
  cultivationLevel: string; // "炼气三层" | "金丹初期" ...
  spiritRoot: string; // "火灵根" | "混沌灵根"
  talents: string[]; // ["剑心通明", "百毒不侵"]
  appearance: string; // 外观描述
  backstory: string; // 背景故事

  // —— 战力相关（用于对战）——
  basePower: number; // 基础战力（1~1000）
  talentBonus: number; // 天赋加成（+0~300）
  totalPower: number; // = basePower + talentBonus + random(-50, +50)
}

/**
 * 境界等级枚举（用于战力计算）
 */
export type CultivationLevelType = 
  | "炼气" 
  | "筑基" 
  | "金丹" 
  | "元婴" 
  | "化神" 
  | "炼虚" 
  | "合体" 
  | "大乘" 
  | "渡劫";

/**
 * 战斗结果
 */
export interface BattleResult {
  winner: Cultivator;
  loser: Cultivator;
  battleReport: string; // AI 生成的战斗播报
  triggeredMiracle: boolean; // 是否触发了"顿悟"机制
}

