import { QUALITY_ORDER } from '@daoyou/constants/qualities';
import {
  BASE_STABILITY_BY_TYPE,
  BASE_TOXICITY_BY_TYPE,
  QUALITY_STABILITY_BONUS,
} from '@daoyou/game-content/alchemy';
import {
  CONTEST_DURATION_MS,
  CONTEST_HEAT,
  CONTEST_MATERIAL_STOCK,
  CONTEST_QI,
  type ContestAttempt,
  type ContestFurnace,
  type ContestHeat,
  type ContestLot,
  type ContestMaterial,
  type ContestQuestion,
  type ContestRecipe,
  type ContestStanding,
} from '@daoyou/game-domain/alchemy/contest';
import {
  normalizeAlchemyEffectRoute,
  resolveAlchemyEffects,
} from './alchemyEffectResolver.js';
import {
  calculateRawEssence,
  rollAlchemyYieldProfile,
} from './alchemyYield.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const heatRules = {
  gentle: {
    stability: 8,
    toxicity: -3,
    fitMultiplier: 0.88,
    focusMode: 'focused',
  },
  steady: {
    stability: 0,
    toxicity: 0,
    fitMultiplier: 1,
    focusMode: 'balanced',
  },
  fierce: {
    stability: -8,
    toxicity: 6,
    fitMultiplier: 1.15,
    focusMode: 'risky',
  },
} as const;

export function contestWeek(now: number, offset = 0) {
  const localDay = Math.floor((now + 8 * HOUR) / DAY) * DAY;
  const wednesday =
    localDay + (3 - (new Date(localDay).getUTCDay() || 7) + 7 * offset) * DAY;
  const opensAt = wednesday + 6 * HOUR;
  return {
    week: new Date(wednesday).toISOString().slice(0, 10),
    opensAt,
    closesAt: opensAt + 2 * HOUR,
    lastStartAt: opensAt + 2 * HOUR - CONTEST_DURATION_MS,
  };
}

export function contestBudget(
  materials: ContestMaterial[],
  attempts: ContestAttempt[],
) {
  const remaining = Object.fromEntries(
    materials.map(({ id }) => [id, CONTEST_MATERIAL_STOCK]),
  ) as Record<string, number>;
  let qi = CONTEST_QI;
  let usedMaterials = 0;
  for (const attempt of attempts) {
    qi -= CONTEST_HEAT[attempt.heat];
    for (const { materialId, dose } of attempt.doses) {
      remaining[materialId] -= dose;
      usedMaterials += dose;
    }
  }
  return { remaining, qi, usedMaterials };
}

export function validContestRecipe(
  recipe: ContestRecipe,
  budget: ReturnType<typeof contestBudget>,
) {
  const total = recipe.doses.reduce((sum, item) => sum + item.dose, 0);
  return (
    recipe.doses.length >= 2 &&
    recipe.doses.length <= 4 &&
    total >= 3 &&
    total <= 5 &&
    CONTEST_HEAT[recipe.heat] <= budget.qi &&
    new Set(recipe.doses.map(({ materialId }) => materialId)).size ===
      recipe.doses.length &&
    recipe.doses.every(
      ({ materialId, dose }) =>
        Number.isInteger(dose) &&
        dose >= 1 &&
        dose <= 2 &&
        (budget.remaining[materialId] ?? 0) >= dose,
    )
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const round = (value: number) => Math.round(value * 100) / 100;

export function brewContestFurnace(
  materials: (ContestMaterial & { dose: number })[],
  heat: ContestHeat,
) {
  const fire = heatRules[heat];
  const contributions = materials.map((material) => ({
    material,
    essence: calculateRawEssence([material]),
  }));
  const totalEssence = contributions.reduce(
    (sum, entry) => sum + entry.essence,
    0,
  );
  const weights = new Map<ContestQuestion['primary'], number>();
  let stability = 0;
  let toxicity = 0;
  for (const { material, essence } of contributions) {
    stability +=
      ((BASE_STABILITY_BY_TYPE[material.type] +
        QUALITY_STABILITY_BONUS[material.rank]) *
        essence) /
      totalEssence;
    toxicity += (BASE_TOXICITY_BY_TYPE[material.type] * essence) / totalEssence;
    for (const { key, weight } of material.properties) {
      weights.set(
        key,
        (weights.get(key) ?? 0) + (weight * essence) / totalEssence,
      );
    }
  }
  const dominant = [...weights.entries()]
    .sort(([left, a], [right, b]) => b - a || left.localeCompare(right))
    .slice(0, 3);
  const route = normalizeAlchemyEffectRoute({
    effects: dominant
      .filter(([, weight], index) => index === 0 || weight >= 0.14)
      .map(([key, weight]) => ({ key, weight })),
  });
  const synergy = dominant[0]?.[1] ?? 0;
  const conflict = weights.size > 2 ? 1 - synergy : 0;
  stability = Math.round(
    clamp(stability + fire.stability - (route.effects.length - 1) * 6, 15, 95),
  );
  toxicity = Math.round(
    clamp(
      toxicity + fire.toxicity + conflict * 5 + Math.max(0, 65 - stability) / 5,
      0,
      100,
    ),
  );
  const yieldProfile = rollAlchemyYieldProfile({
    materials,
    factors: {
      stability,
      synergyScore: synergy,
      conflictScore: conflict,
      fitMultiplier: fire.fitMultiplier,
      focusMode: fire.focusMode,
    },
    rng: () => 0.5,
  });
  const quantities = new Map<ContestLot['quality'], number>();
  for (const { quality, quantity } of yieldProfile.lots) {
    quantities.set(quality, (quantities.get(quality) ?? 0) + quantity);
  }
  const lots = [...quantities.entries()].map(([quality, quantity]) => {
    const effects = resolveAlchemyEffects({
      route,
      quality,
      appearance: 'middle',
    }).effectBreakdown.map(({ key, finalValue }) => ({
      key,
      value: finalValue,
    }));
    return { quality, quantity, effects };
  });
  return { lots, stability, toxicity, purity: yieldProfile.essence.purity };
}

export function scoreContestFurnace(
  result: ReturnType<typeof brewContestFurnace>,
  question: Omit<ContestQuestion, 'pillName'>,
  heat: ContestHeat,
  elapsedMs: number,
  swing: number,
): ContestFurnace {
  const bestEffects = result.lots[0]?.effects ?? [];
  const primary = bestEffects[0]?.key;
  const matchesSecondary = (effects: typeof bestEffects) =>
    !question.secondary ||
    effects
      .slice(1)
      .some(({ key, value }) => key === question.secondary && value > 0);
  const reasons = !result.lots.length
    ? 'empty'
    : primary !== question.primary
      ? 'primary'
      : !matchesSecondary(bestEffects)
        ? 'secondary'
        : result.toxicity > question.maximumToxicity
          ? 'toxicity'
          : null;
  const qualifiedLots = reasons
    ? []
    : result.lots.filter(
        ({ effects }) =>
          matchesSecondary(effects) &&
          (effects[0]?.value ?? 0) >= question.minimumStrength,
      );
  const quantity = qualifiedLots.reduce((sum, lot) => sum + lot.quantity, 0);
  const reason = reasons ?? (quantity ? null : 'strength');
  const baseAppearance =
    (result.stability / 100 + result.purity) * 5 +
    heatRules[heat].stability / 20;
  const appearanceScore = clamp(baseAppearance + clamp(swing, -1, 1), 0, 10);
  const appearance =
    appearanceScore >= 8.5
      ? 'perfect'
      : appearanceScore >= 6
        ? 'high'
        : appearanceScore >= 3
          ? 'middle'
          : 'low';
  const time =
    elapsedMs <= 2 * 60_000
      ? 5
      : elapsedMs <= 4 * 60_000
        ? 4
        : elapsedMs <= 7 * 60_000
          ? 3
          : elapsedMs <= 10 * 60_000
            ? 2
            : elapsedMs <= 13 * 60_000
              ? 1
              : 0;
  const points = {
    effect: quantity
      ? round(
          50 *
            clamp(
              (qualifiedLots[0]?.effects[0]?.value ?? 0) /
                question.strengthForFullScore,
              0,
              1,
            ),
        )
      : 0,
    quality: quantity
      ? round(
          (15 *
            qualifiedLots.reduce(
              (sum, lot) =>
                sum + lot.quantity * (QUALITY_ORDER[lot.quality] + 1),
              0,
            )) /
            (quantity * 8),
        )
      : 0,
    quantity: quantity
      ? round(10 * clamp(quantity / question.quantityForFullScore, 0, 1))
      : 0,
    appearance: quantity ? round(appearanceScore) : 0,
    time: quantity ? time : 0,
  };
  return {
    effects: bestEffects,
    stability: result.stability,
    purity: result.purity,
    toxicity: result.toxicity,
    appearance,
    qualified: !reason,
    reason,
    points,
    lots: result.lots.map(({ quality, quantity }) => ({ quality, quantity })),
    qualifiedLots: qualifiedLots.map(({ quality, quantity }) => ({
      quality,
      quantity,
    })),
    score: round(
      points.effect +
        points.quality +
        points.quantity +
        points.appearance +
        points.time,
    ),
  };
}

export function compareContestStandings(
  a: ContestStanding,
  b: ContestStanding,
) {
  return (
    b.score - a.score ||
    b.effectScore - a.effectScore ||
    a.usedMaterials - b.usedMaterials
  );
}

export function contestStanding(
  materials: ContestMaterial[],
  attempts: ContestAttempt[],
) {
  const best = attempts
    .filter((attempt) => attempt.qualified)
    .sort((a, b) => b.score - a.score || b.points.effect - a.points.effect)[0];
  if (!best) return null;
  const { usedMaterials, qi } = contestBudget(materials, attempts);
  const materialPoints = round(8 * clamp((15 - usedMaterials) / 12, 0, 1));
  const qiPoints = round((2 * qi) / (CONTEST_QI - 1));
  return {
    score: round(best.score + materialPoints + qiPoints),
    effectScore: best.points.effect,
    usedMaterials,
    materialPoints,
    qiPoints,
    bestAttempt: attempts.indexOf(best) + 1,
  };
}

export function contestRewardForRank(rank: number) {
  const reputation =
    rank === 1
      ? 300
      : rank === 2
        ? 250
        : rank === 3
          ? 200
          : rank <= 10
            ? 150
            : rank <= 50
              ? 100
              : 50;
  const odds =
    rank <= 3
      ? { book: 0.01, dew: 0.08, material: 0.4 }
      : rank <= 10
        ? { book: 0.005, dew: 0.05, material: 0.3 }
        : { book: 0.002, dew: 0.02, material: 0.15 };
  return { reputation, odds };
}
