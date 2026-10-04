import { SeededRng } from '@daoyou/combat-core/rng';
import type { BeastSpeciesDefinition } from '@daoyou/game-domain/beasts/authoring';

export type BeastTraits = {
  aptitudes: Record<keyof BeastSpeciesDefinition['aptitudes'], number>;
  growth: number;
  skills: string[];
};

/** 必带之外，每个候选技能独立获得的概率。不按物种配置。 */
export const CANDIDATE_SKILL_CHANCE = 0.5;

/** 接受已通过内容包校验的物种。只抽取生物事实，不创建身份、等级、加点或库存。 */
export function rollBeastTraits(
  species: BeastSpeciesDefinition,
  seed: number,
  isMutant = false,
): BeastTraits {
  // 资质、成长与技能使用独立随机流，互不扰动。
  const statsRng = new SeededRng(seed);
  const skillRng = new SeededRng(seed ^ 0x27d4eb2d);
  const integer = (range: { min: number; max: number }) =>
    range.min + Math.floor(statsRng.next() * (range.max - range.min + 1));
  const aptitudes = {
    attack: integer(species.aptitudes.attack),
    defense: integer(species.aptitudes.defense),
    health: integer(species.aptitudes.health),
    mana: integer(species.aptitudes.mana),
    speed: integer(species.aptitudes.speed),
  };
  const growth = integer(species.growthMilli) / 1000;
  const { core, candidates } = species.birthSkills;
  const skills = [...core];
  for (const id of candidates)
    if (skillRng.next() < CANDIDATE_SKILL_CHANCE) skills.push(id);
  if (isMutant) {
    for (const key of Object.keys(aptitudes) as (keyof typeof aptitudes)[])
      aptitudes[key] = Math.round((aptitudes[key] * 11) / 10);
  }
  return {
    aptitudes,
    growth: isMutant
      ? Math.round((Math.round(growth * 1000) * 11) / 10) / 1000
      : growth,
    skills,
  };
}
