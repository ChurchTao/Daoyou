import {
  QUALITY_VALUES,
  REALM_ORDER,
  type Quality,
  type RealmType,
} from '@shared/types/constants';
import {
  SPIRIT_FIELD_LEVELS,
  SPIRIT_FIELD_PLOT_UNLOCKS,
} from './config';
import type {
  SpiritFieldCareAction,
  SpiritFieldCareNeed,
  SpiritFieldHarvestMode,
  SpiritFieldObservation,
  SpiritFieldPlantSnapshot,
  SpiritFieldPlotState,
} from './types';

export function createDefaultSpiritFieldPlots(): SpiritFieldPlotState[] {
  return Array.from({ length: 6 }, (_, index) => ({
    index,
    plantId: null,
    plant: null,
    plantedAt: null,
    careCount: 0,
    careBoostMs: 0,
    careScoreTotal: 0,
    careScoreCount: 0,
    lastCareAt: null,
    careNeed: null,
  }));
}

function isCareNeed(value: unknown): value is SpiritFieldCareNeed {
  return (
    value === 'moisture_high' ||
    value === 'moisture_low' ||
    value === 'qi_stagnant' ||
    value === 'weak_growth'
  );
}

function normalizePlant(value: unknown): SpiritFieldPlantSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<SpiritFieldPlantSnapshot>;
  if (
    typeof raw.id !== 'string' ||
    typeof raw.name !== 'string' ||
    typeof raw.seedName !== 'string' ||
    !raw.quality ||
    !raw.element ||
    !raw.minRealm ||
    typeof raw.baseGrowthMs !== 'number' ||
    typeof raw.careSlots !== 'number' ||
    typeof raw.careCooldownMs !== 'number' ||
    typeof raw.description !== 'string' ||
    typeof raw.baseYieldMin !== 'number' ||
    typeof raw.baseYieldMax !== 'number'
  ) {
    return null;
  }
  return raw as SpiritFieldPlantSnapshot;
}

export function normalizeSpiritFieldPlots(input: unknown): SpiritFieldPlotState[] {
  const fallback = createDefaultSpiritFieldPlots();
  const plots = Array.isArray(input) ? input : [];
  return fallback.map((base, index) => {
    const raw = plots[index];
    if (!raw || typeof raw !== 'object') return base;
    const plot = raw as Partial<SpiritFieldPlotState>;
    const plant = normalizePlant(plot.plant);
    return {
      index,
      plantId: plant?.id ?? null,
      plant,
      plantedAt:
        plant && typeof plot.plantedAt === 'string' ? plot.plantedAt : null,
      careCount: Math.max(0, Math.floor(Number(plot.careCount ?? 0))),
      careBoostMs: Math.max(0, Math.floor(Number(plot.careBoostMs ?? 0))),
      careScoreTotal: Math.max(
        0,
        Math.floor(Number(plot.careScoreTotal ?? 0)),
      ),
      careScoreCount: Math.max(
        0,
        Math.floor(Number(plot.careScoreCount ?? 0)),
      ),
      lastCareAt:
        plant && typeof plot.lastCareAt === 'string' ? plot.lastCareAt : null,
      careNeed: plant && isCareNeed(plot.careNeed) ? plot.careNeed : null,
    };
  });
}

export function getSpiritFieldLevelConfig(level: number) {
  return SPIRIT_FIELD_LEVELS[
    Math.min(SPIRIT_FIELD_LEVELS.length - 1, Math.max(0, Math.floor(level)))
  ]!;
}

export function isSpiritFieldPlotUnlocked(args: {
  plotIndex: number;
  realm: RealmType;
  selfHarvestCount: number;
}): boolean {
  const rule = SPIRIT_FIELD_PLOT_UNLOCKS[args.plotIndex];
  if (!rule) return false;
  return (
    REALM_ORDER[args.realm] >= REALM_ORDER[rule.minRealm] &&
    args.selfHarvestCount >= rule.minHarvest
  );
}

export function canPlantSpiritFieldSeed(
  realm: RealmType,
  plant: SpiritFieldPlantSnapshot,
): boolean {
  return REALM_ORDER[realm] >= REALM_ORDER[plant.minRealm];
}

export function calculateSpiritFieldGrowth(args: {
  plot: SpiritFieldPlotState;
  fieldLevel: number;
  nowMs?: number;
}): { progress: number; mature: boolean; remainingMs: number } {
  const plant = args.plot.plant;
  if (!plant || !args.plot.plantedAt) {
    return { progress: 0, mature: false, remainingMs: 0 };
  }
  const plantedAt = Date.parse(args.plot.plantedAt);
  const now = args.nowMs ?? Date.now();
  const elapsed = Math.max(0, now - plantedAt) + args.plot.careBoostMs;
  const speedMultiplier = 1 + getSpiritFieldLevelConfig(args.fieldLevel).speedBonus;
  const effective = elapsed * speedMultiplier;
  const progress = Math.min(1, effective / plant.baseGrowthMs);
  const remainingEffective = Math.max(0, plant.baseGrowthMs - effective);
  return {
    progress,
    mature: progress >= 1,
    remainingMs: remainingEffective / speedMultiplier,
  };
}

export function getNextCareAt(plot: SpiritFieldPlotState): number | null {
  if (!plot.plant || !plot.lastCareAt) return null;
  return Date.parse(plot.lastCareAt) + plot.plant.careCooldownMs;
}

export function deterministicUnit(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

export function getCareNeedWeights(
  plant?: SpiritFieldPlantSnapshot | null,
): Record<SpiritFieldCareNeed, number> {
  const weights: Record<SpiritFieldCareNeed, number> = {
    moisture_high: 1,
    moisture_low: 1,
    qi_stagnant: 1,
    weak_growth: 1,
  };
  const tags = new Set(plant?.careStyleTags ?? []);

  // 习性只影响“更容易遇到什么问题”，不改变最终奖励公式。
  if (tags.has('moisture-loving')) weights.moisture_low += 1.5;
  if (tags.has('drought-tolerant')) weights.moisture_high += 0.75;
  if (tags.has('water-sensitive')) weights.moisture_high += 1.5;
  if (tags.has('qi-sensitive')) weights.qi_stagnant += 1.5;
  if (tags.has('fertile-soil')) weights.weak_growth += 1.25;
  if (tags.has('loose-soil')) weights.qi_stagnant += 0.75;

  return weights;
}

export function chooseCareNeed(
  seed: string,
  plant?: SpiritFieldPlantSnapshot | null,
): SpiritFieldCareNeed {
  const needs: SpiritFieldCareNeed[] = [
    'moisture_high',
    'moisture_low',
    'qi_stagnant',
    'weak_growth',
  ];
  const weights = getCareNeedWeights(plant);
  const total = needs.reduce((sum, need) => sum + weights[need], 0);
  let cursor = deterministicUnit(seed) * total;
  for (const need of needs) {
    cursor -= weights[need];
    if (cursor <= 0) return need;
  }
  return needs[needs.length - 1]!;
}

export function buildSpiritFieldObservations(
  need: SpiritFieldCareNeed | null,
): SpiritFieldObservation[] {
  switch (need) {
    case 'moisture_high':
      return [
        { topic: 'leaf', label: '叶色', text: '嫩叶略垂，叶缘带着潮重之感。', suggestedAction: '先看看是否土壤过湿。' },
        { topic: 'soil', label: '土壤', text: '泥土湿意偏重，指尖一捻仍会结团。', suggestedAction: '尝试疏土或温和祛湿。' },
        { topic: 'aura', label: '灵气', text: '根旁灵气尚足，却被湿气压得流转稍慢。', suggestedAction: '不要继续大量灌溉。' },
      ];
    case 'moisture_low':
      return [
        { topic: 'leaf', label: '叶色', text: '叶尖微卷，灵光显得有些干涩。', suggestedAction: '可考虑少量润养。' },
        { topic: 'soil', label: '土壤', text: '表土已经发干，细裂纹沿根旁散开。', suggestedAction: '少量灵泉比猛灌更稳妥。' },
        { topic: 'aura', label: '灵气', text: '水意偏弱，其余灵机仍算平稳。', suggestedAction: '补水即可，不必强行催生。' },
      ];
    case 'qi_stagnant':
      return [
        { topic: 'leaf', label: '叶色', text: '叶片无明显病相，却迟迟不见舒展。', suggestedAction: '问题可能不在水分。' },
        { topic: 'soil', label: '土壤', text: '土层松紧适中，看不出明显积水或干裂。', suggestedAction: '可从灵气流转入手。' },
        { topic: 'aura', label: '灵气', text: '根部灵机像被细结绊住，周转不畅。', suggestedAction: '尝试温养或疏导灵机。' },
      ];
    case 'weak_growth':
    default:
      return [
        { topic: 'leaf', label: '叶色', text: '新芽生得慢，但暂未出现明显枯败。', suggestedAction: '适合温和养护或适量施肥。' },
        { topic: 'soil', label: '土壤', text: '土性平稳，没有特别突出的异常。', suggestedAction: '可少量补充肥力，不宜过量。' },
        { topic: 'aura', label: '灵气', text: '整株灵机偏弱，像是缺少持续温养。', suggestedAction: '可用相合灵力缓缓培护。' },
      ];
  }
}

export function evaluateCareAction(
  need: SpiritFieldCareNeed | null,
  action: SpiritFieldCareAction,
) {
  const best: Partial<Record<SpiritFieldCareNeed, SpiritFieldCareAction[]>> = {
    moisture_high: ['dry_soil', 'loosen_soil'],
    moisture_low: ['moisten'],
    qi_stagnant: ['wood_nurture', 'loosen_soil'],
    weak_growth: ['wood_nurture', 'fertilize'],
  };
  if (action === 'observe' || action === 'wait') {
    return { grade: 'neutral' as const, boostPercent: 0, careScore: 0 };
  }
  if (need && best[need]?.includes(action)) {
    return { grade: 'excellent' as const, boostPercent: 0.06, careScore: 100 };
  }
  if (
    action === 'wood_nurture' ||
    action === 'loosen_soil' ||
    action === 'fertilize'
  ) {
    return { grade: 'good' as const, boostPercent: 0.04, careScore: 70 };
  }
  return { grade: 'poor' as const, boostPercent: 0.01, careScore: 35 };
}

export function getCareQiCost(action: SpiritFieldCareAction): number {
  switch (action) {
    case 'wood_nurture':
      return 6;
    case 'dry_soil':
    case 'moisten':
      return 5;
    case 'fertilize':
      return 4;
    case 'loosen_soil':
      return 3;
    default:
      return 0;
  }
}

export function getSpiritFieldCareScore(plot: SpiritFieldPlotState): number {
  if (plot.careScoreCount <= 0) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round(plot.careScoreTotal / plot.careScoreCount)),
  );
}

function careYieldMultiplier(score: number): number {
  if (score >= 95) return 1.35;
  if (score >= 80) return 1.2;
  if (score >= 60) return 1.1;
  return 1;
}

function modeYieldMultiplier(mode: SpiritFieldHarvestMode): number {
  return mode === 'broad' ? 1.15 : 0.9;
}

export function calculateSpiritFieldHarvestQuantity(args: {
  plot: SpiritFieldPlotState;
  fieldLevel: number;
  mode: SpiritFieldHarvestMode;
  seed: string;
}): number {
  const plant = args.plot.plant;
  if (!plant) return 0;
  const span = plant.baseYieldMax - plant.baseYieldMin + 1;
  const base = plant.baseYieldMin + Math.floor(deterministicUnit(`${args.seed}:base`) * span);
  const care = careYieldMultiplier(getSpiritFieldCareScore(args.plot));
  const field = 1 + Math.min(0.18, Math.max(0, args.fieldLevel) * 0.03);
  return Math.max(1, Math.round(base * care * field * modeYieldMultiplier(args.mode)));
}

export function getNextQuality(quality: Quality): Quality | null {
  const index = QUALITY_VALUES.indexOf(quality);
  return index >= 0 && index < QUALITY_VALUES.length - 1
    ? QUALITY_VALUES[index + 1]!
    : null;
}

export function getSpiritFieldQualityUpgradeChance(args: {
  careScore: number;
  fieldLevel: number;
  mode: SpiritFieldHarvestMode;
}): number {
  let chance = 0;
  if (args.careScore >= 95) chance = 0.15;
  else if (args.careScore >= 80) chance = 0.08;
  else if (args.careScore >= 60) chance = 0.03;
  chance += Math.min(0.08, Math.max(0, args.fieldLevel) * 0.01);
  chance *= args.mode === 'focused' ? 1.75 : 0.5;
  return Math.min(0.35, chance);
}

export function getSpiritFieldSeedReturnQuantity(args: {
  careScore: number;
  mode: SpiritFieldHarvestMode;
  seed: string;
}): number {
  let firstChance = 0.45;
  if (args.careScore >= 95) firstChance = 0.95;
  else if (args.careScore >= 80) firstChance = 0.82;
  else if (args.careScore >= 60) firstChance = 0.65;
  firstChance += args.mode === 'broad' ? 0.05 : -0.05;
  firstChance = Math.max(0.2, Math.min(0.98, firstChance));

  let quantity = deterministicUnit(`${args.seed}:seed:1`) < firstChance ? 1 : 0;
  const secondChance =
    args.careScore >= 95
      ? args.mode === 'broad'
        ? 0.3
        : 0.2
      : args.careScore >= 80
        ? args.mode === 'broad'
          ? 0.2
          : 0.1
        : 0;
  if (deterministicUnit(`${args.seed}:seed:2`) < secondChance) quantity += 1;
  return quantity;
}

export function getSpiritFieldRareCareDropChance(args: {
  careScore: number;
  mode: SpiritFieldHarvestMode;
}): number {
  const base = 0.06 + Math.min(0.2, args.careScore * 0.002);
  return Math.min(0.3, base + (args.mode === 'broad' ? 0.04 : 0));
}
