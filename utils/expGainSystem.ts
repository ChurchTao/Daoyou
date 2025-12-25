import type { CultivationProgress, Cultivator } from '@/types/cultivator';
import {
  calculateExpProgress,
  canAttemptBreakthrough,
  getCultivationProgress,
  isBottleneckReached,
} from './cultivationUtils';

/**
 * 修为增加来源
 */
export type ExpGainSource =
  | 'retreat' // 闭关修炼
  | 'battle' // 战斗获胜
  | 'dungeon' // 副本探索
  | 'pill' // 炼丹服用
  | 'event' // 奇遇事件
  | 'reward'; // 系统奖励

/**
 * 修为增加结果
 */
export interface ExpGainResult {
  success: boolean;
  exp_gained: number; // 实际获得的修为
  exp_before: number; // 原有修为
  exp_after: number; // 新修为
  progress: number; // 进度百分比
  capped: boolean; // 是否达到上限
  bottleneck_entered: boolean; // 是否进入瓶颈期
  can_breakthrough: boolean; // 是否可突破
  message?: string; // 提示信息
}

/**
 * 修为增加选项
 */
export interface ExpGainOptions {
  source: ExpGainSource;
  base_amount: number; // 基础修为数量
  bypass_bottleneck?: boolean; // 是否绕过瓶颈期限制（特殊事件可用）
  bypass_cap_limit?: boolean; // 是否绕过30%丹药限制（高级丹药可用）
  insight_gain?: number; // 同时获得的感悟值（可选）
}

/**
 * 统一的修为增加入口
 * @param cultivator 角色对象
 * @param options 增加选项
 * @returns 增加结果和更新后的修为进度
 */
export function addCultivationExp(
  cultivator: Cultivator,
  options: ExpGainOptions,
): {
  result: ExpGainResult;
  updated_progress: CultivationProgress;
} {
  // 确保有修为进度数据
  const progress = getCultivationProgress(cultivator);
  const exp_before = progress.cultivation_exp;
  const exp_cap = progress.exp_cap;

  // 检查是否在瓶颈期
  if (
    progress.bottleneck_state &&
    options.source === 'retreat' &&
    !options.bypass_bottleneck
  ) {
    return {
      result: {
        success: false,
        exp_gained: 0,
        exp_before,
        exp_after: exp_before,
        progress: calculateExpProgress(progress),
        capped: false,
        bottleneck_entered: true,
        can_breakthrough: canAttemptBreakthrough(progress),
        message: '已入瓶颈，闭关效率大减。需通过副本、战斗等方式寻求突破。',
      },
      updated_progress: progress,
    };
  }

  // 计算实际获得修为
  let exp_gained = options.base_amount;

  // 瓶颈期衰减（仅闭关受影响）
  if (
    progress.bottleneck_state &&
    options.source === 'retreat' &&
    !options.bypass_bottleneck
  ) {
    exp_gained *= 0.5;
  }

  // 检查是否会超过上限
  let capped = false;
  const potential_exp = exp_before + exp_gained;
  if (potential_exp > exp_cap) {
    exp_gained = exp_cap - exp_before;
    capped = true;
  }

  // 更新修为
  progress.cultivation_exp = Math.min(exp_before + exp_gained, exp_cap);

  // 更新感悟值（如果有）
  if (options.insight_gain && options.insight_gain > 0) {
    progress.comprehension_insight = Math.min(
      100,
      progress.comprehension_insight + options.insight_gain,
    );
  }

  // 检查是否进入瓶颈期
  const bottleneck_entered = isBottleneckReached(progress);
  if (bottleneck_entered && !progress.bottleneck_state) {
    progress.bottleneck_state = true;
  }

  // 生成提示信息
  let message = '';
  if (capped) {
    message = '修为已达当前境界上限，可尝试突破。';
  } else if (bottleneck_entered && options.source === 'retreat') {
    message =
      '修为渐近圆满，已入瓶颈期。闭关效率降低，建议通过其他方式积累感悟。';
  }

  return {
    result: {
      success: true,
      exp_gained,
      exp_before,
      exp_after: progress.cultivation_exp,
      progress: calculateExpProgress(progress),
      capped,
      bottleneck_entered,
      can_breakthrough: canAttemptBreakthrough(progress),
      message,
    },
    updated_progress: progress,
  };
}

/**
 * 战斗获取修为的辅助函数
 * @param cultivator 角色
 * @param enemy_realm 敌人境界
 * @param victory_type 胜利类型
 */
export function calculateBattleExpGain(
  cultivator: Cultivator,
  enemy_realm: string,
  victory_type: 'normal' | 'perfect' | 'challenged',
): number {
  // 基础奖励（根据敌人境界）
  const BASE_REWARDS: Record<string, number> = {
    炼气: 50,
    筑基: 200,
    金丹: 600,
    元婴: 1500,
    化神: 3500,
    炼虚: 7000,
    合体: 12000,
    大乘: 20000,
    渡劫: 35000,
  };

  const base = BASE_REWARDS[enemy_realm] || 50;

  // 境界差系数
  const REALM_ORDER = [
    '炼气',
    '筑基',
    '金丹',
    '元婴',
    '化神',
    '炼虚',
    '合体',
    '大乘',
    '渡劫',
  ];
  const myIndex = REALM_ORDER.indexOf(cultivator.realm);
  const enemyIndex = REALM_ORDER.indexOf(enemy_realm);
  const realmDiff = enemyIndex - myIndex;

  let realmMultiplier = 1.0;
  if (realmDiff >= 2) {
    realmMultiplier = 2.0;
  } else if (realmDiff === 1) {
    realmMultiplier = 1.5;
  } else if (realmDiff === 0) {
    realmMultiplier = 1.0;
  } else {
    realmMultiplier = 0.5;
  }

  // 胜利类型系数
  const victoryMultiplier =
    victory_type === 'perfect'
      ? 1.3
      : victory_type === 'challenged'
        ? 1.2
        : 1.0;

  return Math.floor(base * realmMultiplier * victoryMultiplier);
}

/**
 * 副本获取修为的辅助函数
 * @param cultivator 角色
 * @param dungeon_result 副本结果
 */
export function calculateDungeonExpGain(
  cultivator: Cultivator,
  dungeon_result: 'perfect' | 'good' | 'normal' | 'failed',
): number {
  if (!cultivator.cultivation_progress) {
    return 0;
  }

  const exp_cap = cultivator.cultivation_progress.exp_cap;

  // 根据副本完成度给予百分比奖励
  const percentages: Record<typeof dungeon_result, number> = {
    perfect: 0.15, // 圆满通关：15%
    good: 0.1, // 良好通关：10%
    normal: 0.05, // 普通通关：5%
    failed: 0.02, // 失败：2%
  };

  return Math.floor(exp_cap * percentages[dungeon_result]);
}

/**
 * 丹药修为增加的辅助函数
 * @param cultivator 角色
 * @param pill_quality 丹药品质
 */
export function calculatePillExpGain(
  cultivator: Cultivator,
  pill_quality: '凡品' | '灵品' | '玄品' | '真品',
): {
  exp_gain: number;
  can_use: boolean;
  reason?: string;
} {
  if (!cultivator.cultivation_progress) {
    return { exp_gain: 0, can_use: false, reason: '修为数据异常' };
  }

  const exp_cap = cultivator.cultivation_progress.exp_cap;

  // 检查丹药使用限制（当前境界服药获得的修为不超过30%）
  // TODO: 需要在cultivation_progress中添加pill_exp_gained字段来追踪
  // 此处暂时允许使用

  const percentages: Record<typeof pill_quality, number> = {
    凡品: 0.02, // 2%
    灵品: 0.05, // 5%
    玄品: 0.1, // 10%
    真品: 0.2, // 20%
  };

  return {
    exp_gain: Math.floor(exp_cap * percentages[pill_quality]),
    can_use: true,
  };
}
