import type {
  BreakthroughResult,
  CultivationResult,
} from '@daoyou/shared/engine/cultivation/CultivationEngine';
import { z } from 'zod';
import type { PlayerResourceMutationMeta } from './player.js';

export const RetreatRequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('cultivate'),
    years: z.number().int().min(1).max(200),
    requestId: z.uuid(),
  }),
  z.object({ action: z.literal('breakthrough'), requestId: z.uuid() }),
]);

export type RetreatRequest = z.infer<typeof RetreatRequestSchema>;

export type RetreatAction = 'cultivate' | 'breakthrough';
export type RetreatStoryType = 'breakthrough' | 'lifespan';

export interface RetreatResultData {
  summary: BreakthroughResult['summary'] | CultivationResult['summary'];
  action: RetreatAction;
  story?: string;
  storyType?: RetreatStoryType | null;
  depleted?: boolean;
}

export type RetreatStreamEvent =
  | {
      type: 'result';
      data: RetreatResultData;
    }
  | {
      type: 'state';
      state: PlayerResourceMutationMeta;
    }
  | {
      type: 'chunk';
      text: string;
    }
  | {
      type: 'error';
      error: string;
    };
