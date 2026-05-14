/**
 * 单个物品评分（Phase 1 过渡版）
 *
 * 旧版评分依赖 engine/effect 的 EffectConfig 体系，已下线。
 * 当前实现仅基于品质/品阶给出粗粒度评分，便于排行榜过渡使用；
 * 真正的 v2 评分由 engine/creation-v2/persistence/ScoreCalculator 在持久化时写入 product.score。
 */

import { Quality } from '@shared/types/constants';
import { Artifact, Consumable } from '@shared/types/cultivator';

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

export function calculateSingleArtifactScore(artifact: Artifact): number {
  if (typeof artifact.score === 'number') {
    return artifact.score;
  }
  const base = QUALITY_SCORE_MAP[artifact.quality || '凡品'] || 80;
  return Math.floor(Math.max(1, base));
}

export function calculateSingleElixirScore(consumable: Consumable): number {
  if (typeof consumable.score === 'number') {
    return consumable.score;
  }
  const base = QUALITY_SCORE_MAP[consumable.quality || '凡品'] || 80;
  return Math.floor(Math.max(1, base * 0.72));
}
