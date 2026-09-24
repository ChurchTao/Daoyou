import {
  DivinationDirectionSchema,
  type DivinationDice,
  type DivinationDirection,
  type DivinationOmen,
} from '@shared/lib/divination';
import { z } from 'zod';
import type { PlayerResourceMutationMeta } from './player';

export const DivinationDrawSchema = z
  .object({ direction: DivinationDirectionSchema })
  .strict();
export const DivinationInterpretSchema = z
  .object({ drawId: z.uuid() })
  .strict();
export interface DivinationRecord {
  drawId: string;
  dayKey: string;
  direction: DivinationDirection;
  dice: DivinationDice;
  omen: DivinationOmen;
  total: number;
  interpretation: string | null;
  fallback: boolean;
  rewardName: string;
  rewardGranted: boolean;
}
export interface DivinationView {
  today: string;
  canDraw: boolean;
  record: DivinationRecord | null;
}
export type DivinationStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'interpretation'; record: DivinationRecord }
  | {
      type: 'complete';
      record: DivinationRecord;
      state: PlayerResourceMutationMeta;
    }
  | { type: 'error'; message: string };
