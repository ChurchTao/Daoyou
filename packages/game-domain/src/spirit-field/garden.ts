import type { ElementType } from '@daoyou/constants/elements';
import type { Quality } from '@daoyou/constants/qualities';
import type { RealmType } from '@daoyou/constants/realms';
import { z } from 'zod';
import { PILL_FAMILY_VALUES, type PillFamily } from '../consumable.js';
import type { SpiritSeedGrowthForm, SpiritSeedHarvestPart } from './types.js';

/** IDs are authored in the content catalog; runtime validators bind to that registry. */
export type SpiritGardenSpeciesId = string;
export interface SpiritGardenFruitEffect {
  family: Exclude<PillFamily, 'hybrid'>;
  share: number;
}
export const SpiritGardenFruitEffectsSchema = z
  .array(
    z
      .object({
        family: z.enum(PILL_FAMILY_VALUES).exclude(['hybrid']),
        share: z.number().finite().positive().max(1),
      })
      .strict(),
  )
  .min(1)
  .max(3)
  .superRefine((effects, ctx) => {
    if (
      Math.abs(effects.reduce((sum, effect) => sum + effect.share, 0) - 1) >
      1e-8
    )
      ctx.addIssue({ code: 'custom', message: '灵果药效份额必须合计为一' });
    if (new Set(effects.map((effect) => effect.family)).size !== effects.length)
      ctx.addIssue({ code: 'custom', message: '灵果药效不可重复' });
    if (
      effects.some((effect) => effect.family === 'beast_cultivation') &&
      effects.length !== 1
    )
      ctx.addIssue({
        code: 'custom',
        message: '灵兽修为效果不可与人物效果混合',
      });
  });
export const SPIRIT_GARDEN_BRANCHES = ['abundance', 'essence'] as const;
export type SpiritGardenBranch = (typeof SPIRIT_GARDEN_BRANCHES)[number];
export interface SpiritGardenOutput {
  name: string;
  description: string;
  kind: 'herb' | 'tcdb' | 'spirit_fruit';
  fruitFamily?: PillFamily;
  fruitEffects?: SpiritGardenFruitEffect[];
  quantity: number;
  cycleMs: number;
}
export interface SpiritGardenSpecies {
  id: SpiritGardenSpeciesId;
  name: string;
  description: string;
  element: ElementType;
  quality: Quality;
  portrait: { atlas: string; index: number };
  growthForm: SpiritSeedGrowthForm;
  harvestPart: SpiritSeedHarvestPart;
  matureMs: number;
  branchMs: number;
  evolveMs: number;
  baseOutput: Omit<SpiritGardenOutput, 'quantity' | 'cycleMs'>;
  branches: Record<
    SpiritGardenBranch,
    {
      name: string;
      description: string;
      output: Omit<SpiritGardenOutput, 'quantity' | 'cycleMs'>;
    }
  >;
}
export interface SpiritGardenProduct {
  speciesId: SpiritGardenSpeciesId;
  name: string;
  description: string;
  element: ElementType;
  kind: 'herb' | 'tcdb' | 'spirit_fruit';
  fruitFamily?: PillFamily;
  fruitEffects?: SpiritGardenFruitEffect[];
  quality: Quality;
  quantity: number;
}
export type SpiritGardenIncidentKind = 'pests' | 'beast' | 'mutation';
export interface SpiritGardenIncident {
  kind: SpiritGardenIncidentKind;
  productionDay: number;
  occurredAt: number;
  seedSpeciesId: SpiritGardenSpeciesId | null;
}
export interface SpiritGardenSeedReward {
  speciesId: SpiritGardenSpeciesId;
  quality: Quality;
  quantity: 1;
}
export interface SpiritGardenEvolutionAttempt {
  atProductionMs: number;
  succeeded: boolean;
}
export interface SpiritGardenPlant {
  id: string;
  speciesId: SpiritGardenSpeciesId;
  seedName: string;
  quality: Quality;
  activeGrowthMs: number;
  settledAt: number;
  productionMs: number;
  /** Tenths of a millisecond retained by the 10% mutation bonus. */
  productionBonusRemainder: number;
  storedProductionMs: number;
  productionUsedMs: number;
  /** Actual production time, excluding recovery, used only for incident draws. */
  productionClockMs: number;
  incidents: SpiritGardenIncident[];
  recoveryRemainingMs: number;
  pendingSeedSpeciesId: SpiritGardenSpeciesId | null;
  firstYieldGranted: boolean;
  branch: SpiritGardenBranch | null;
  branchAtProductionMs: number | null;
  evolved: boolean;
  evolutionAttempts: SpiritGardenEvolutionAttempt[];
  pending: SpiritGardenProduct[];
}
export interface SpiritGardenPlot {
  index: number;
  plant: SpiritGardenPlant | null;
}
export interface SpiritGardenCodexEntry {
  speciesId: SpiritGardenSpeciesId;
  matured: boolean;
  branches: SpiritGardenBranch[];
  evolved: boolean;
}
export interface SpiritGardenState {
  version: 2;
  plots: SpiritGardenPlot[];
  collection: SpiritGardenPlant[];
  codex: SpiritGardenCodexEntry[];
}
export interface SpiritGardenPlantView extends SpiritGardenPlant {
  speciesName: string;
  description: string;
  stage: 'seedling' | 'mature' | 'nurtured' | 'evolved';
  outputQuality: Quality;
  output: SpiritGardenOutput;
  matureMs: number;
  branchMs: number;
  evolveMs: number;
  nextYieldMs: number;
  remainingProductionMs: number;
  remainingHarvestCycles: number;
  exhausted: boolean;
  mutated: boolean;
  canMature: boolean;
  matureQiCost: number;
  branchQiCost: number;
  branchRemainingMs: number;
  evolveRemainingMs: number;
  evolveCooldownRemainingMs: number;
  evolutionAttemptsRemaining: number;
  evolveSuccessChance: number;
  canBranch: boolean;
  canEvolve: boolean;
  evolveReason: string | null;
  evolveCost: {
    spiritStones: number;
    qi: number;
    materialKind: 'herb';
    materialQuality: Quality;
    quantity: 1;
    minRealm: RealmType;
  };
  storageFull: boolean;
}
