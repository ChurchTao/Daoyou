import type { PlayerStateMutationResponse } from './player';
import type { CultivatorSectState, SectDefinition } from '@shared/engine/sect';
import type { BattleRecord } from '@shared/types/battle';
import { z } from 'zod';

export const SectLevelTrainRequestSchema = z.object({ targetLevel: z.number().int().positive() });
export const SectMethodTrainRequestSchema = SectLevelTrainRequestSchema;
export const SectPathTrainRequestSchema = SectLevelTrainRequestSchema;
export const SectMeridianLoadoutRequestSchema = z.object({ nodeIds: z.array(z.string().min(1).max(64)).max(6) });
export const SectAbilityLoadoutRequestSchema = z.object({ abilityIds: z.array(z.string().min(1).max(64).nullable()).length(4) });
export const SectTacticRequestSchema = z.object({ tacticId: z.string().min(1).max(32) });

export type SectCatalogEntry = {
  definition: SectDefinition;
  status?: CultivatorSectState['status'];
  experiencedAt?: string;
};

export type SectCatalogData = {
  playerRace: 'human';
  raceNarrative?: string;
  sects: SectCatalogEntry[];
  activeSectId?: string;
};

export type SectCurrentData = {
  playerRace: 'human';
  raceNarrative?: string;
  definition: SectDefinition | null;
  sect: CultivatorSectState | null;
  methodLevelCap: number;
  knownAbilityIds: string[];
  commission: { dateKey: string; completionType?: string; completedAt?: string; claimedAt?: string };
};

export type SectDetailData = {
  definition: SectDefinition;
  sect: CultivatorSectState | null;
  methodLevelCap: number;
  knownAbilityIds: string[];
};

export type SectExperienceResponse = PlayerStateMutationResponse<{ sect: CultivatorSectState; battle: BattleRecord }>;
export type SectMutationResponse = PlayerStateMutationResponse<{ sect: CultivatorSectState }>;
export type SectTrainResponse = PlayerStateMutationResponse<{
  sect: CultivatorSectState;
  methodId?: string;
  pathId?: string;
  targetLevel: number;
  cost: { contribution: number; spiritStones: number };
}>;
