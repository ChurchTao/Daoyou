import { SeededRng } from '../core/rng';
import { distributeBeastPoints } from './allocation';
import { BEAST_GENERATION, BEAST_SPECIES } from './content';
import { BEAST_FUSION, BEAST_FUSION_VERSION } from './fusion-config';
import { beastPointBudget } from './identity';
import {
  BeastSchema,
  GeneratedBeastSchema,
  type BeastLineup,
  type SummonedBeast,
} from './schema';

export function beastFusionMaterialReason(
  beast: SummonedBeast,
  ownerLevel: number,
  lineup: BeastLineup,
): string {
  if (beast.isMutant) return '变异灵兽不能参与融合';
  if (beast.level < BEAST_FUSION.minimumLevel)
    return `灵兽须达到${BEAST_FUSION.minimumLevel}级`;
  if (
    beast.level > ownerLevel ||
    !BEAST_SPECIES.some(
      (s) => s.id === beast.speciesId && s.carryLevel <= ownerLevel,
    )
  )
    return '主人等级或携带境界不足';
  if (
    lineup.leadBeastId === beast.id ||
    lineup.carriedBeastIds.includes(beast.id)
  )
    return '请先移出携带编组并取消首发';
  return '';
}
export function beastFusionReason(
  a: SummonedBeast,
  b: SummonedBeast,
  ownerLevel: number,
  lineup: BeastLineup,
): string {
  if (a.id === b.id) return '请选择两只不同的灵兽';
  if (a.ownerCultivatorId !== b.ownerCultivatorId) return '只能融合自己的灵兽';
  return (
    beastFusionMaterialReason(a, ownerLevel, lineup) ||
    beastFusionMaterialReason(b, ownerLevel, lineup)
  );
}
export function fusionPreview(a: SummonedBeast, b: SummonedBeast) {
  return [...new Set([a.speciesId, b.speciesId])].map((speciesId) => {
    const species = BEAST_SPECIES.find((s) => s.id === speciesId)!;
    return {
      speciesId,
      core: species.birthSkills.core,
      maxSkills: new Set([
        ...a.skills,
        ...b.skills,
        ...species.birthSkills.core,
      ]).size,
    };
  });
}
function rollWeight(rng: SeededRng, rows: typeof BEAST_FUSION.aptitudeWeights) {
  let draw = rng.next() * 100;
  for (const row of rows) {
    draw -= row.weight;
    if (draw < 0) return row.value;
  }
  return rows[rows.length - 1].value;
}
/** Host validates ownership, carrying requirements and occupancy before committing. */
export function fuseBeasts(
  first: SummonedBeast,
  second: SummonedBeast,
  id: string,
  seed: number,
): SummonedBeast {
  const [a, b] = [BeastSchema.parse(first), BeastSchema.parse(second)].sort(
    (x, y) => x.id.localeCompare(y.id),
  );
  const reason = beastFusionReason(a, b, 180, {
    carriedBeastIds: [],
    revision: 0,
  });
  if (reason) throw new Error(reason);
  if (id === a.id || id === b.id) throw new Error('融合结果必须使用新个体ID');
  const speciesId =
    new SeededRng(seed ^ 0x14381f).next() < 0.5 ? a.speciesId : b.speciesId;
  const species = BEAST_SPECIES.find((s) => s.id === speciesId)!;
  const identityDraw = new SeededRng(seed ^ 0x5bd1e995).next();
  const originKind =
    a.originKind === 'baby' && b.originKind === 'baby'
      ? identityDraw < BEAST_FUSION.babyChance
        ? 'baby'
        : 'pseudo_baby'
      : identityDraw < BEAST_FUSION.pseudoBabyChance
        ? 'pseudo_baby'
        : 'wild';
  const level = originKind === 'wild' ? Math.floor((a.level + b.level) / 2) : 0;
  const skillRng = new SeededRng(seed ^ 0x27d4eb2d);
  const core = species.birthSkills.core;
  const skills = [
    ...core,
    ...[...new Set([...a.skills, ...b.skills])]
      .sort()
      .filter(
        (skill) =>
          !core.includes(skill) && skillRng.next() < BEAST_FUSION.skillChance,
      ),
  ];
  const aptitudes = { ...a.aptitudes };
  for (const [index, key] of (
    Object.keys(aptitudes) as (keyof typeof aptitudes)[]
  ).entries()) {
    const coefficient = rollWeight(
      new SeededRng(seed ^ (0x45d9f3b + index * 0x113)),
      BEAST_FUSION.aptitudeWeights,
    );
    aptitudes[key] = Math.max(
      1,
      Math.min(
        BEAST_FUSION.aptitudeCaps[key],
        Math.round(((a.aptitudes[key] + b.aptitudes[key]) * coefficient) / 200),
      ),
    );
  }
  const growthCoefficient = rollWeight(
    new SeededRng(seed ^ 0x73ac981),
    BEAST_FUSION.growthWeights,
  );
  const growthMilli = Math.round(
    ((Math.round(a.growth * 1000) + Math.round(b.growth * 1000)) *
      growthCoefficient) /
      200,
  );
  const budget = beastPointBudget({ originKind, initialLevel: level, level });
  return GeneratedBeastSchema.parse({
    id,
    ownerCultivatorId: a.ownerCultivatorId,
    speciesId,
    name: species.name,
    originKind,
    initialLevel: level,
    level,
    exp: 0,
    aptitudes,
    growth:
      Math.max(100, Math.min(BEAST_FUSION.growthMilliCap, growthMilli)) / 1000,
    allocatedAttributes: distributeBeastPoints(
      originKind === 'wild' ? budget : 0,
      seed ^ 0x615bf,
      0.3,
    ),
    unallocatedPoints: originKind === 'wild' ? 0 : budget,
    skills,
    skillSlotCapacity: skills.length,
    currentLifespan: BEAST_GENERATION.lifespan,
    maxLifespan: BEAST_GENERATION.lifespan,
    generationVersion: BEAST_FUSION_VERSION,
    generationContentRevision: BEAST_FUSION.contentRevision,
    generationSeed: seed,
    revision: 0,
  });
}
