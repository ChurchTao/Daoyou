import { z } from 'zod';
import type { BattleMatchPlayerViewV1 } from '../engine/battle-v5/match/types';
import type { CompactBattlePresentationWindowV1 } from '../online-battle/BattlePresentation';

const MatchIdSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9_-]+$/);
const RequestIdSchema = z.string().uuid();
const ClientIntentSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('basic_attack'),
      targetUnitId: z.string().min(1).max(160),
    })
    .strict(),
  z
    .object({
      kind: z.literal('ability'),
      abilityId: z.string().min(1).max(160),
      targetUnitId: z.string().min(1).max(160).optional(),
    })
    .strict(),
]);

export const BattleClientMessageSchema = z.discriminatedUnion('type', [
  z
    .object({
      protocolVersion: z.literal(2),
      type: z.literal('battle.resume'),
      requestId: RequestIdSchema,
      matchId: MatchIdSchema,
      lastEventSeq: z.number().int().min(-1),
    })
    .strict(),
  z
    .object({
      protocolVersion: z.literal(2),
      type: z.literal('round.submit'),
      requestId: RequestIdSchema,
      matchId: MatchIdSchema,
      round: z.number().int().positive(),
      checkpointRevision: z.number().int().nonnegative(),
      intents: z
        .record(z.string().min(1).max(160), ClientIntentSchema)
        .superRefine((value, context) => {
          if (Object.keys(value).length > 4) {
            context.addIssue({
              code: 'too_big',
              maximum: 4,
              origin: 'object',
              inclusive: true,
              message: 'A player may submit at most four unit intents',
            });
          }
        }),
    })
    .strict(),
  z
    .object({
      protocolVersion: z.literal(2),
      type: z.literal('presentation.ready'),
      requestId: RequestIdSchema,
      matchId: MatchIdSchema,
      round: z.number().int().positive(),
      resultId: z.string().min(1).max(200),
    })
    .strict(),
  z
    .object({
      protocolVersion: z.literal(2),
      type: z.literal('time.ping'),
      requestId: RequestIdSchema,
      clientSentAt: z.number().finite(),
    })
    .strict(),
]);

export type BattleClientMessageV2 = z.infer<typeof BattleClientMessageSchema>;

export type OnlineBattlePlayerViewV2 = Omit<
  BattleMatchPlayerViewV1,
  'latestResolution'
> & {
  readonly protocolVersion: 2;
  readonly clientEventSeq: number;
  readonly latestResult?: Pick<
    NonNullable<BattleMatchPlayerViewV1['latestResolution']>,
    'commandSetId' | 'round' | 'outcome'
  >;
  readonly roundResult?: CompactBattlePresentationWindowV1;
};

type BattleEventBaseV2 = {
  readonly protocolVersion: 2;
  readonly matchId: string;
  readonly revision: number;
  readonly eventSeq: number;
  readonly serverNow: number;
};

export type BattleServerMessageV2 =
  | {
      readonly type: 'battle.snapshot';
      readonly payload: OnlineBattlePlayerViewV2;
    }
  | {
      readonly type: 'command.ack';
      readonly payload: {
        readonly commandType: 'round.submit' | 'presentation.ready';
        readonly requestId: string;
        readonly status: 'accepted' | 'duplicate' | 'rejected';
        readonly reason?: string;
        readonly revision: number;
        readonly serverNow: number;
      };
    }
  | { readonly type: 'battle.resume_ok'; readonly payload: BattleEventBaseV2 }
  | {
      readonly type: 'time.pong';
      readonly payload: {
        readonly requestId: string;
        readonly clientSentAt: number;
        readonly serverNow: number;
        readonly revision: number;
        readonly eventSeq: number;
      };
    }
  | {
      readonly type: 'battle.error';
      readonly payload: {
        readonly requestId?: string;
        readonly code: string;
        readonly message: string;
        readonly serverNow: number;
      };
    };

const PublicSnapshotSchema = z
  .object({
    version: z.literal('battle_public_snapshot_v1'),
    battleId: z.string().min(1).max(160),
    round: z.number().int().nonnegative(),
    checkpointRevision: z.number().int().nonnegative(),
    units: z
      .array(
        z
          .object({
            unitId: z.string().min(1).max(160),
            teamId: z.string().min(1).max(160),
            alive: z.boolean(),
            hp: z
              .object({
                current: z.number(),
                max: z.number(),
                percent: z.number(),
              })
              .passthrough(),
            mp: z
              .object({
                current: z.number(),
                max: z.number(),
                percent: z.number(),
              })
              .passthrough(),
          })
          .passthrough(),
      )
      .max(8),
  })
  .strict();

const EventBaseSchema = {
  protocolVersion: z.literal(2),
  matchId: MatchIdSchema,
  revision: z.number().int().nonnegative(),
  eventSeq: z.number().int().nonnegative(),
  serverNow: z.number().finite(),
};

export const BattleServerMessageSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('battle.snapshot'),
      payload: z
        .object({
          protocolVersion: z.literal(2),
          matchId: MatchIdSchema,
          status: z.enum([
            'waiting',
            'planning',
            'resolving',
            'presenting',
            'resolution_failed',
            'finished',
            'cancelled',
          ]),
          revision: z.number().int().nonnegative(),
          clientEventSeq: z.number().int().nonnegative(),
          serverNow: z.number().finite(),
          publicSnapshot: PublicSnapshotSchema,
        })
        .passthrough(),
    })
    .strict(),
  z
    .object({
      type: z.literal('command.ack'),
      payload: z
        .object({
          commandType: z.enum(['round.submit', 'presentation.ready']),
          requestId: RequestIdSchema,
          status: z.enum(['accepted', 'duplicate', 'rejected']),
          reason: z.string().optional(),
          revision: z.number().int().nonnegative(),
          serverNow: z.number().finite(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal('battle.resume_ok'),
      payload: z.object(EventBaseSchema).strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal('time.pong'),
      payload: z
        .object({
          requestId: RequestIdSchema,
          clientSentAt: z.number().finite(),
          serverNow: z.number().finite(),
          revision: z.number().int().nonnegative(),
          eventSeq: z.number().int().nonnegative(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      type: z.literal('battle.error'),
      payload: z
        .object({
          requestId: RequestIdSchema.optional(),
          code: z.string().min(1).max(120),
          message: z.string().min(1).max(500),
          serverNow: z.number().finite(),
        })
        .strict(),
    })
    .strict(),
]);
