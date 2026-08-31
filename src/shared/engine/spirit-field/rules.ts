import { QUALITY_ORDER, QUALITY_VALUES, REALM_ORDER, type Quality, type RealmType } from '@shared/types/constants';
import { SPIRIT_FIELD_METHOD_MAP } from './config';
import { SPIRIT_FIELD_STAGES, type SpiritFieldCultivationMethod, type SpiritFieldHarvestSettlement, type SpiritFieldOutcomeKind, type SpiritFieldPlantSnapshot, type SpiritFieldPlotRuntimeStatus, type SpiritFieldPlotState, type SpiritFieldStageAffinity } from './types';

export function deterministicUnit(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) { hash ^= seed.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0) / 4294967296;
}

export function createDefaultSpiritFieldPlots(): SpiritFieldPlotState[] { return Array.from({ length: 6 }, (_, index) => resetSpiritFieldPlot(index)); }
export function resetSpiritFieldPlot(index: number): SpiritFieldPlotState { return { index, plantId: null, plant: null, plantedAt: null, stageIndex: 0, stageStartedAt: null, stageEndsAt: null, history: [] }; }

function isPlant(value: unknown): value is SpiritFieldPlantSnapshot {
  if (!value || typeof value !== 'object') return false;
  const plant = value as Partial<SpiritFieldPlantSnapshot>;
  return typeof plant.id === 'string' && typeof plant.seedName === 'string' && typeof plant.seedDescription === 'string' && Boolean(plant.quality) && Boolean(plant.element) && Boolean(plant.minRealm) && Boolean(plant.stageDurationMs) && typeof plant.baseYieldMin === 'number' && typeof plant.baseYieldMax === 'number';
}

export function normalizeSpiritFieldPlots(input: unknown): SpiritFieldPlotState[] {
  const source = Array.isArray(input) ? input : [];
  return createDefaultSpiritFieldPlots().map((empty, index) => {
    const raw = source[index];
    if (!raw || typeof raw !== 'object') return empty;
    const plot = raw as Partial<SpiritFieldPlotState>;
    if (!isPlant(plot.plant)) return empty;
    return { index, plantId: plot.plant.id, plant: plot.plant, plantedAt: typeof plot.plantedAt === 'string' ? plot.plantedAt : null, stageIndex: Math.min(2, Math.max(0, Math.floor(Number(plot.stageIndex ?? 0)))), stageStartedAt: typeof plot.stageStartedAt === 'string' ? plot.stageStartedAt : null, stageEndsAt: typeof plot.stageEndsAt === 'string' ? plot.stageEndsAt : null, history: Array.isArray(plot.history) ? plot.history.slice(0, 3) : [] };
  });
}

export function canPlantSpiritFieldSeed(realm: RealmType, plant: SpiritFieldPlantSnapshot): boolean { return REALM_ORDER[realm] >= REALM_ORDER[plant.minRealm]; }
export function isSpiritFieldPlotUnlocked(): boolean { return true; }

export function getSpiritFieldPlotRuntime(plot: SpiritFieldPlotState, nowMs = Date.now()): { status: SpiritFieldPlotRuntimeStatus; stage: (typeof SPIRIT_FIELD_STAGES)[number] | null; progress: number; remainingMs: number } {
  if (!plot.plant) return { status: 'empty', stage: null, progress: 0, remainingMs: 0 };
  const stage = SPIRIT_FIELD_STAGES[plot.stageIndex] ?? 'forming';
  if (!plot.stageStartedAt || !plot.stageEndsAt) return { status: 'awaiting_cultivation', stage, progress: 0, remainingMs: 0 };
  const start = Date.parse(plot.stageStartedAt);
  const end = Date.parse(plot.stageEndsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || nowMs >= end) {
    if (plot.stageIndex >= 2) return { status: 'ready_to_harvest', stage, progress: 1, remainingMs: 0 };
    return { status: 'awaiting_cultivation', stage: SPIRIT_FIELD_STAGES[plot.stageIndex + 1]!, progress: 0, remainingMs: 0 };
  }
  return { status: 'growing', stage, progress: Math.max(0, Math.min(1, (nowMs - start) / Math.max(1, end - start))), remainingMs: Math.max(0, end - nowMs) };
}

export function advanceSpiritFieldPlotToDecision(plot: SpiritFieldPlotState, nowMs = Date.now()): SpiritFieldPlotState {
  const runtime = getSpiritFieldPlotRuntime(plot, nowMs);
  if (runtime.status !== 'awaiting_cultivation' || !plot.stageEndsAt || plot.stageIndex >= 2) return plot;
  return { ...plot, stageIndex: plot.stageIndex + 1, stageStartedAt: null, stageEndsAt: null };
}

export function getAffinityScore(affinity: SpiritFieldStageAffinity): number { return affinity === 'excellent' ? 100 : affinity === 'good' ? 78 : affinity === 'neutral' ? 60 : 38; }
export function getStageDurationMs(plant: SpiritFieldPlantSnapshot, method: SpiritFieldCultivationMethod, affinity: SpiritFieldStageAffinity): number {
  const definition = SPIRIT_FIELD_METHOD_MAP[method];
  const stage = definition.stage;
  const multiplier = affinity === 'excellent' ? 0.86 : affinity === 'good' ? 0.94 : affinity === 'strained' ? 1.12 : 1;
  return Math.max(60_000, Math.round(plant.stageDurationMs[stage] * multiplier * (definition.durationMultiplier ?? 1)));
}

export function getCultivationResourceCost(method: SpiritFieldCultivationMethod, quality: Quality): { amount: number; spiritStones: number } {
  const definition = SPIRIT_FIELD_METHOD_MAP[method];
  const rank = QUALITY_ORDER[quality];
  const amount = definition.resourceKind === 'qi' ? Math.ceil(definition.baseCost * (1 + rank * 0.35)) : definition.resourceKind === 'mp' ? Math.ceil(definition.baseCost * (1 + rank * 0.25)) : definition.resourceKind === 'spirit_stones' ? Math.ceil(definition.baseCost * (1 + rank * 0.75)) : definition.baseCost;
  const spiritStones = Math.ceil((definition.extraSpiritStoneCost ?? 0) * (1 + rank * 0.75));
  return { amount, spiritStones };
}

function adjacentQuality(quality: Quality, delta: -1 | 1): Quality { const index = QUALITY_VALUES.indexOf(quality); return QUALITY_VALUES[Math.max(0, Math.min(QUALITY_VALUES.length - 1, index + delta))]!; }
function chooseOutcome(weights: Record<SpiritFieldOutcomeKind, number>, seed: string): SpiritFieldOutcomeKind {
  const entries = Object.entries(weights) as Array<[SpiritFieldOutcomeKind, number]>;
  const total = entries.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0);
  let cursor = deterministicUnit(`${seed}:outcome`) * total;
  for (const [kind, weight] of entries) { cursor -= Math.max(0, weight); if (cursor <= 0) return kind; }
  return 'herb';
}

export function settleSpiritFieldHarvest(plot: SpiritFieldPlotState, seed: string): SpiritFieldHarvestSettlement {
  const plant = plot.plant;
  if (!plant) throw new Error('空田不可结算');
  const score = plot.history.length > 0 ? Math.round(plot.history.reduce((sum, item) => sum + item.score, 0) / plot.history.length) : 50;
  const weights: Record<SpiritFieldOutcomeKind, number> = { herb: 3, tcdb: 1, spirit_fruit: 1 };
  for (const bias of plant.outcomeBiases) weights[bias] += 2;
  const formingMethod = plot.history.find((item) => item.stage === 'forming')?.method;
  if (formingMethod === 'leaf_medicine') weights.herb += 7;
  if (formingMethod === 'flower_fruit') weights.spirit_fruit += 7;
  if (formingMethod === 'return_treasure') weights.tcdb += 7;
  const outcomeKind = chooseOutcome(weights, seed);
  const mutationRoll = deterministicUnit(`${seed}:quality`);
  const mutated = score >= 85 && mutationRoll < 0.28 && plant.quality !== '神品';
  const degraded = score < 48 && mutationRoll < 0.55 && plant.quality !== '凡品';
  const quality = mutated ? adjacentQuality(plant.quality, 1) : degraded ? adjacentQuality(plant.quality, -1) : plant.quality;
  const span = plant.baseYieldMax - plant.baseYieldMin + 1;
  const baseQuantity = plant.baseYieldMin + Math.floor(deterministicUnit(`${seed}:quantity`) * span);
  const scoreMultiplier = score >= 90 ? 1.25 : score >= 72 ? 1.1 : score < 48 ? 0.75 : 1;
  const quantity = outcomeKind === 'herb' ? Math.max(1, Math.round(baseQuantity * scoreMultiplier)) : outcomeKind === 'spirit_fruit' ? Math.max(1, Math.min(3, Math.round((baseQuantity / 2) * scoreMultiplier))) : Math.max(1, Math.min(2, Math.round((baseQuantity / 3) * scoreMultiplier)));
  const fruitFamily = plant.useTags.includes('longevity') ? 'longevity' : plant.useTags.includes('marrow-wash') ? 'marrow_wash' : plant.useTags.includes('breakthrough') ? 'breakthrough' : plant.useTags.includes('body-tempering') ? 'tempering' : plant.useTags.includes('detox') ? 'detox' : plant.useTags.includes('qi-restoration') ? 'mana' : plant.useTags.includes('healing') ? 'healing' : plant.useTags.includes('spirit-nourishing') ? 'insight' : 'cultivation';
  return { outcomeKind, quality, quantity, score, mutated, degraded, fruitFamily };
}
