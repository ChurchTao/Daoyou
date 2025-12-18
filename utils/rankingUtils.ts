import { Quality } from '@/types/constants';
import { Artifact, Consumable, Skill } from '@/types/cultivator';

const QUALITY_SCORE_MAP: Record<Quality, number> = {
  凡品: 10,
  灵品: 30,
  玄品: 60,
  真品: 120,
  地品: 250,
  天品: 500,
  仙品: 1000,
  神品: 2500,
};

const SKILL_GRADE_SCORE_MAP: Record<string, number> = {
  天阶上品: 1000,
  天阶中品: 800,
  天阶下品: 600,
  地阶上品: 400,
  地阶中品: 300,
  地阶下品: 200,
  玄阶上品: 100,
  玄阶中品: 80,
  玄阶下品: 60,
  黄阶上品: 40,
  黄阶中品: 20,
  黄阶下品: 10,
};

/**
 * 计算单个法宝评分
 */
export function calculateSingleArtifactScore(artifact: Artifact): number {
  // 基础分基于品质
  let score = QUALITY_SCORE_MAP[artifact.quality || '凡品'] || 10;

  // 基础属性
  if (artifact.bonus) {
    score += Object.values(artifact.bonus).reduce((a, b) => a + b, 0);
  }

  // 附加分：每个词条 +20%
  const effectCount = artifact.special_effects?.length || 0;
  score *= 1 + effectCount * 0.2;

  // 诅咒扣分? 暂时不扣，诅咒也是稀有度体现

  return Math.floor(score);
}

/**
 * 计算单个神通评分
 */
export function calculateSingleSkillScore(skill: Skill): number {
  let score = SKILL_GRADE_SCORE_MAP[skill.grade || '黄阶下品'] || 10;

  // 威力修正
  if (skill.power) {
    score += skill.power;
  }

  // 消耗过大稍微减分? 不，消耗大通常威力大

  return Math.floor(score);
}

/**
 * 计算单个丹药评分
 */
export function calculateSingleElixirScore(consumable: Consumable): number {
  // 丹药主要看品质
  let score = QUALITY_SCORE_MAP[consumable.quality || '凡品'] || 10;

  // 基础属性
  if (consumable.effect) {
    score += consumable.effect?.map((e) => e.bonus).reduce((a, b) => a + b, 0);
  }

  return score;
}
