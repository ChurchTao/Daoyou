import type { RealmType } from '@daoyou/constants/realms';
import type {
  SpiritGardenCodexEntry,
  SpiritGardenPlantView,
  SpiritGardenSpecies,
  SpiritGardenSpeciesId,
} from '@daoyou/game-domain/spirit-field';
import {
  SPIRIT_GARDEN_BRANCHES,
  SPIRIT_GARDEN_SPECIES_IDS,
} from '@daoyou/game-domain/spirit-field';
import { z } from 'zod';

export const SpiritFieldPlotIndexSchema = z.number().int().min(0).max(5);
const command = {
  requestId: z.string().trim().min(8).max(128),
  expectedVersion: z.number().int().nonnegative(),
};
const plantCommand = {
  ...command,
  plotIndex: SpiritFieldPlotIndexSchema,
  plantId: z.string().min(1).max(160),
};
export const SpiritFieldSowRequestSchema = z
  .object({
    ...command,
    plotIndex: SpiritFieldPlotIndexSchema,
    seedMaterialId: z.uuid(),
    revision: z.number().int().nonnegative(),
  })
  .strict();
export const SpiritFieldHarvestRequestSchema = z.object(command).strict();
export const SpiritFieldBranchRequestSchema = z
  .object({ ...plantCommand, branch: z.enum(SPIRIT_GARDEN_BRANCHES) })
  .strict();
export const SpiritFieldEvolveRequestSchema = z
  .object({
    ...plantCommand,
    resourceId: z.uuid(),
    resourceRevision: z.number().int().nonnegative(),
  })
  .strict();
export const SpiritFieldArchiveRequestSchema = z.object(plantCommand).strict();
export const SpiritFieldRestoreRequestSchema = z.object(plantCommand).strict();
export const SpiritFieldExchangeRequestSchema = z
  .object({ ...command, speciesId: z.enum(SPIRIT_GARDEN_SPECIES_IDS) })
  .strict();
export type SpiritFieldSowRequest = z.infer<typeof SpiritFieldSowRequestSchema>;
export type SpiritFieldHarvestRequest = z.infer<
  typeof SpiritFieldHarvestRequestSchema
>;
export type SpiritFieldBranchRequest = z.infer<
  typeof SpiritFieldBranchRequestSchema
>;
export type SpiritFieldEvolveRequest = z.infer<
  typeof SpiritFieldEvolveRequestSchema
>;
export type SpiritFieldArchiveRequest = z.infer<
  typeof SpiritFieldArchiveRequestSchema
>;
export type SpiritFieldRestoreRequest = z.infer<
  typeof SpiritFieldRestoreRequestSchema
>;
export type SpiritFieldExchangeRequest = z.infer<
  typeof SpiritFieldExchangeRequestSchema
>;
export interface SpiritFieldSnapshot {
  profile: {
    version: number;
    starterClaimed: boolean;
    successfulHarvestCount: number;
    maturedSpeciesCount: number;
    offlineCapMs: number;
    collectionLimit: number;
  };
  player: { realm: RealmType; spiritStones: number };
  plots: { index: number; plant: SpiritGardenPlantView | null }[];
  collection: SpiritGardenPlantView[];
  codex: SpiritGardenCodexEntry[];
  species: SpiritGardenSpecies[];
  pendingQuantity: number;
  exchanges: {
    speciesId: SpiritGardenSpeciesId;
    unlocked: boolean;
    requiredMatured: number;
    spiritStones: number;
    quality: '凡品';
  }[];
}
export const SpiritFieldStarterRequestSchema = z.object(command).strict();
export type SpiritFieldStarterRequest = z.infer<
  typeof SpiritFieldStarterRequestSchema
>;

export const SpiritFieldRetireRequestSchema = z
  .object({ ...command, plantId: z.string().min(1).max(160) })
  .strict();
export type SpiritFieldRetireRequest = z.infer<
  typeof SpiritFieldRetireRequestSchema
>;
