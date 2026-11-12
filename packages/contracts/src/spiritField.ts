import type { RealmType } from '@daoyou/constants/realms';
import type {
  SpiritGardenCodexEntry,
  SpiritGardenPlantView,
  SpiritGardenPlot,
  SpiritGardenSpecies,
} from '@daoyou/game-domain/spirit-field';
import { SPIRIT_GARDEN_BRANCHES } from '@daoyou/game-domain/spirit-field';
import { z } from 'zod';

export const SpiritFieldPlotIndexSchema = z.number().int().min(0).max(5);
const command = {
  requestId: z.string().trim().min(8).max(128),
  expectedVersion: z.number().int().nonnegative(),
};
const plantTarget = {
  plotIndex: SpiritFieldPlotIndexSchema,
  plantId: z.string().min(1).max(160),
};
const plantCommand = { ...command, ...plantTarget };
const batchTargets = z
  .array(z.object(plantTarget).strict())
  .min(1)
  .max(6)
  .superRefine((targets, ctx) => {
    if (
      new Set(targets.map((target) => target.plotIndex)).size !==
        targets.length ||
      new Set(targets.map((target) => target.plantId)).size !== targets.length
    )
      ctx.addIssue({ code: 'custom', message: '同批目标田块和灵植不可重复' });
  });
export const SpiritFieldSowRequestSchema = z
  .object({
    ...command,
    plotIndex: SpiritFieldPlotIndexSchema,
    seedMaterialId: z.uuid(),
    revision: z.number().int().nonnegative(),
  })
  .strict();
export const SpiritFieldHarvestRequestSchema = z.object(command).strict();
export const SpiritFieldMatureRequestSchema = z.object(plantCommand).strict();
export const SpiritFieldMatureBatchRequestSchema = z
  .object({ ...command, targets: batchTargets })
  .strict();
export const SpiritFieldBranchRequestSchema = z
  .object({ ...plantCommand, branch: z.enum(SPIRIT_GARDEN_BRANCHES) })
  .strict();
export const SpiritFieldBranchBatchRequestSchema = z
  .object({
    ...command,
    targets: batchTargets,
    branch: z.enum(SPIRIT_GARDEN_BRANCHES),
  })
  .strict();
export const SpiritFieldEvolveRequestSchema = z
  .object({
    ...plantCommand,
    resourceId: z.uuid(),
    resourceRevision: z.number().int().nonnegative(),
  })
  .strict();
export const SpiritFieldArchiveRequestSchema = z.object(plantCommand).strict();
export const SpiritFieldUprootRequestSchema = z.object(plantCommand).strict();
export type SpiritFieldUprootRequest = z.infer<
  typeof SpiritFieldUprootRequestSchema
>;
export const SpiritFieldRestoreRequestSchema = z.object(plantCommand).strict();
export type SpiritFieldSowRequest = z.infer<typeof SpiritFieldSowRequestSchema>;
export type SpiritFieldHarvestRequest = z.infer<
  typeof SpiritFieldHarvestRequestSchema
>;
export type SpiritFieldMatureRequest = z.infer<
  typeof SpiritFieldMatureRequestSchema
>;
export type SpiritFieldMatureBatchRequest = z.infer<
  typeof SpiritFieldMatureBatchRequestSchema
>;
export type SpiritFieldBranchRequest = z.infer<
  typeof SpiritFieldBranchRequestSchema
>;
export type SpiritFieldBranchBatchRequest = z.infer<
  typeof SpiritFieldBranchBatchRequestSchema
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
  plots: (Omit<SpiritGardenPlot, 'plant' | 'unknownPlant'> & {
    plant: SpiritGardenPlantView | null;
    unknownPlant?: Pick<
      NonNullable<SpiritGardenPlot['unknownPlant']>,
      'id' | 'quality'
    >;
  })[];
  collection: SpiritGardenPlantView[];
  codex: SpiritGardenCodexEntry[];
  species: SpiritGardenSpecies[];
  pendingQuantity: number;
}
export const SpiritFieldStarterRequestSchema = z.object(command).strict();
export type SpiritFieldStarterRequest = z.infer<
  typeof SpiritFieldStarterRequestSchema
>;

export const SpiritFieldRetireRequestSchema = z
  .object({
    ...command,
    plantId: z.string().min(1).max(160),
    plotIndex: SpiritFieldPlotIndexSchema.optional(),
  })
  .strict();
export type SpiritFieldRetireRequest = z.infer<
  typeof SpiritFieldRetireRequestSchema
>;
