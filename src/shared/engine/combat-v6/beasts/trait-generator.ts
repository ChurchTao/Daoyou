import { SeededRng } from '../core/rng';
import type { BeastSpeciesDefinition } from './pack';

export type BeastTraits = {
  aptitudes: Record<keyof BeastSpeciesDefinition['aptitudes'], number>;
  growth: number;
  skills: string[];
};

/** 接受已通过内容包校验的物种。只抽取生物事实，不创建身份、等级、加点或库存。 */
export function rollBeastTraits(
  species: BeastSpeciesDefinition,
  seed: number,
): BeastTraits {
  // 保留原资质、成长抽签顺序；技能数量与选择使用独立随机流。
  const statsRng = new SeededRng(seed);
  const countRng = new SeededRng(seed ^ 0x5bd1e995);
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
  const { core, candidates, extraCountWeights } = species.birthSkills;
  const total = extraCountWeights.reduce((sum, row) => sum + row.weight, 0);
  let draw = countRng.next() * total;
  let extraCount = extraCountWeights[extraCountWeights.length - 1].count;
  for (const row of extraCountWeights) {
    if (draw < row.weight) {
      extraCount = row.count;
      break;
    }
    draw -= row.weight;
  }
  const remaining = [...candidates];
  const skills = [...core];
  for (let i = 0; i < extraCount; i++) {
    const index = Math.floor(skillRng.next() * remaining.length);
    skills.push(remaining.splice(index, 1)[0]);
  }
  return { aptitudes, growth, skills };
}
