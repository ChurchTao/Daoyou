/**
 * 单个物品评分（Phase 1 过渡版）
 *
 * 旧版评分依赖 engine/effect 的 EffectConfig 体系，已下线。
 * 当前实现仅基于品质/品阶给出粗粒度评分，便于排行榜过渡使用；
 * 丹药评分保持原有规则；历史战斗产物直接保留存档评分。
 */

import { calculatePillScore } from '@shared/lib/pillScore';
import { Quality } from '@shared/types/constants';
import { Consumable } from '@shared/types/cultivator';

const QUALITY_SCORE_MAP: Record<Quality, number> = {
  凡品: 80,
  灵品: 180,
  玄品: 360,
  真品: 700,
  地品: 1300,
  天品: 2400,
  仙品: 4300,
  神品: 7600,
};

export function calculateSingleElixirScore(consumable: Consumable): number {
  const pillScore = calculatePillScore(consumable);
  if (pillScore !== null) {
    return pillScore;
  }

  if (
    typeof consumable.score === 'number' &&
    Number.isFinite(consumable.score) &&
    consumable.score > 0
  ) {
    return Math.round(consumable.score);
  }
  const base = QUALITY_SCORE_MAP[consumable.quality || '凡品'] || 80;
  return Math.floor(Math.max(1, base * 0.72));
}
