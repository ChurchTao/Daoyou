import type { PlayerStateMutationResponse } from './player';
import type { CultivatorSectState, LingxiaoMethodId, SectTacticId } from '@shared/engine/sect';
import type { BattleRecord } from '@shared/types/battle';
import { z } from 'zod';

export const SectMethodTrainRequestSchema = z.object({ targetLevel: z.number().int().positive() });
export const SectMeridianLoadoutRequestSchema = z.object({ nodeIds: z.array(z.string()).max(6) });
export const SectAbilityLoadoutRequestSchema = z.object({ abilityIds: z.array(z.string()).max(4) });
export const SectTacticRequestSchema = z.object({ tacticId: z.enum(['aggressive', 'steady', 'counter']) });

export type SectCurrentData = {
  playerRace: 'human';
  raceNarrative?: string;
  sect: CultivatorSectState | null;
  methodLevelCap: number;
  knownAbilityIds: string[];
  commission: { dateKey: string; completionType?: string; completedAt?: string; claimedAt?: string };
};

export type SectCurrentResponse = { success: true; data: SectCurrentData };
export type SectExperienceResponse = PlayerStateMutationResponse<{ sect: CultivatorSectState; battle: BattleRecord }>;
export type SectMutationResponse = PlayerStateMutationResponse<{ sect: CultivatorSectState }>;
export type SectTrainResponse = PlayerStateMutationResponse<{
  sect: CultivatorSectState;
  methodId: LingxiaoMethodId;
  targetLevel: number;
  cost: { contribution: number; spiritStones: number };
}>;
export type SectTacticRequest = { tacticId: SectTacticId };
