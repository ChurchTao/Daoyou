import { z } from 'zod';
import type {
  CombatV6DeltaFrameV1,
  CombatV6TrainingSessionViewV1,
  CombatV6TrainingUnitViewV1,
} from './combatV6';

/** Stored display facts use authoritative event cursors; API projection reindexes them. */
export type CombatV6ReplayTimeline = {
  format: 'delta-v1';
  initialUnits: CombatV6TrainingUnitViewV1[];
  finalUnits?: CombatV6TrainingUnitViewV1[];
  initialRound: number;
  fromEventSeq: number;
  frames: CombatV6DeltaFrameV1[];
};
export type CombatV6ReplayDisplay = NonNullable<
  CombatV6TrainingSessionViewV1['display']
>;
const unitSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    side: z.union([z.literal(0), z.literal(1)]),
    slot: z.number().int(),
    kind: z.enum(['player', 'pet', 'npc']).optional(),
    ownerId: z.string().optional(),
    publicBars: z.boolean().optional(),
    attributes: z.record(z.string(), z.number()).optional(),
    hp: z.number(),
    maxHp: z.number(),
    mp: z.number(),
    maxMp: z.number(),
    wound: z.number(),
    downed: z.boolean(),
    dead: z.boolean(),
    escaped: z.boolean(),
    statuses: z.array(
      z
        .object({
          id: z.string(),
          name: z.string().optional(),
          remainingRounds: z.number(),
          stacks: z.number(),
        })
        .strict(),
    ),
    barriers: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        current: z.number(),
        remainingRounds: z.number(),
      }),
    ),
    resources: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        current: z.number(),
        max: z.number(),
      }),
    ),
  })
  .strict();
export const CombatV6ReplayTimelineSchema = z
  .object({
    format: z.literal('delta-v1'),
    initialUnits: z.array(unitSchema),
    finalUnits: z.array(unitSchema).optional(),
    initialRound: z.number().int().positive(),
    fromEventSeq: z.number().int().min(-1),
    frames: z.array(
      z.object({
        afterEventSeq: z.number().int().min(-1),
        round: z.number().int().positive(),
        updates: z.array(
          z.object({
            id: z.string(),
            set: unitSchema.omit({ id: true }).partial(),
            unset: z
              .array(z.enum(['kind', 'ownerId', 'attributes', 'publicBars']))
              .optional(),
          }),
        ),
        added: z.array(unitSchema).optional(),
        removed: z.array(z.string()).optional(),
        order: z.array(z.string()).optional(),
      }),
    ),
  })
  .superRefine((value, ctx) => {
    let seq = value.fromEventSeq;
    for (const frame of value.frames) {
      if (frame.afterEventSeq < seq)
        ctx.addIssue({
          code: 'custom',
          message: 'Replay cursor must not move backwards',
        });
      seq = frame.afterEventSeq;
    }
  });
export const CombatV6HistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  source: z
    .enum([
      'training-room',
      'wild-encounter',
      'arena-sparring',
      'dungeon',
      'tower',
      'ranking',
    ])
    .optional(),
});
export type CombatV6HistoryQuery = z.infer<typeof CombatV6HistoryQuerySchema>;
export type CombatV6HistoryItem = {
  battleId: string;
  sourceType: string;
  finishedAt: string;
  roundCount: number;
  sides: [string[], string[]];
  outcome: 'victory' | 'defeat' | 'draw' | 'aborted';
};
export type CombatV6HistoryPage = {
  items: CombatV6HistoryItem[];
  page: number;
  hasMore: boolean;
};
