/**
 * 单个物品评分（Phase 1 过渡版）
 *
 * 旧版评分依赖 engine/effect 的 EffectConfig 体系，已下线。
 * 当前实现仅基于品质/品阶给出粗粒度评分，便于排行榜过渡使用；
 * 真正的 v2 评分由 engine/creation-v2/persistence/ScoreCalculator 在持久化时写入 product.score。
 */

import { Quality } from '@/types/constants';
import {
  Artifact,
  Consumable,
  CultivationTechnique,
  Skill,
} from '@/types/cultivator';

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

const SKILL_GRADE_SCORE_MAP: Record<string, number> = {
  天阶上品: 4200,
  天阶中品: 3500,
  天阶下品: 2900,
  地阶上品: 2300,
  地阶中品: 1900,
  地阶下品: 1550,
  玄阶上品: 1150,
  玄阶中品: 900,
  玄阶下品: 700,
  黄阶上品: 520,
  黄阶中品: 360,
  黄阶下品: 240,
};

export function calculateSingleArtifactScore(artifact: Artifact): number {
  if (typeof artifact.score === 'number') {
    return artifact.score;
  }
  const base = QUALITY_SCORE_MAP[artifact.quality || '凡品'] || 80;
  return Math.floor(Math.max(1, base));
}

export function calculateSingleSkillScore(skill: Skill): number {
  const base = SKILL_GRADE_SCORE_MAP[skill.grade || '黄阶下品'] || 240;
  return Math.floor(Math.max(1, base));
}

export function calculateSingleElixirScore(consumable: Consumable): number {
  if (typeof consumable.score === 'number') {
    return consumable.score;
  }
  const base = QUALITY_SCORE_MAP[consumable.quality || '凡品'] || 80;
  return Math.floor(Math.max(1, base * 0.72));
}

export function calculateSingleTechniqueScore(
  technique: CultivationTechnique,
): number {
  if (typeof technique.score === 'number') {
    return technique.score;
  }
  const base = SKILL_GRADE_SCORE_MAP[technique.grade || '黄阶下品'] || 240;
  return Math.floor(Math.max(1, base * 0.9));
}
