import {
  getArtifactDisplayInfo,
  getSkillDisplayInfo,
} from '@/lib/utils/effectDisplay';
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

  // 从 effects 中提取属性加成
  const displayInfo = getArtifactDisplayInfo(artifact);
  for (const bonus of displayInfo.statBonuses) {
    score += bonus.value;
  }

  // 附加分：每个特效 +20%
  const effectCount = displayInfo.effects.length;
  score *= 1 + effectCount * 0.2;

  return Math.floor(score);
}

/**
 * 计算单个神通评分
 */
export function calculateSingleSkillScore(skill: Skill): number {
  let score = SKILL_GRADE_SCORE_MAP[skill.grade || '黄阶下品'] || 10;

  // 从 effects 中提取威力
  const displayInfo = getSkillDisplayInfo(skill);
  score += displayInfo.power;

  return Math.floor(score);
}

/**
 * 计算单个丹药评分
 */
export function calculateSingleElixirScore(consumable: Consumable): number {
  // 丹药主要看品质
  const score = QUALITY_SCORE_MAP[consumable.quality || '凡品'] || 10;

  // 基础属性

  return score;
}
