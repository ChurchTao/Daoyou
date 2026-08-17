import { z } from 'zod';

export const BACKGROUND_COMMAND_STREAM = 'DAOYOU_BACKGROUND_COMMANDS';
export const BACKGROUND_COMMAND_SUBJECT_PREFIX = 'daoyou.command.cron';

export const BACKGROUND_COMMAND_TYPES = [
  'auction.expire',
  'bet-battle.expire',
  'ranking.rewards.distribute',
  'market.refresh',
  'tower.enemy-sets.refresh',
  'resource-replay.cleanup',
  'expired-data.cleanup',
  'material-library.generate',
  'sponsorship.reconcile',
  'sponsorship.deep-reconcile',
  'sponsorship.cleanup',
  'sponsorship.admin-digest',
] as const;

export type BackgroundCommandType = (typeof BACKGROUND_COMMAND_TYPES)[number];

export const BACKGROUND_COMMAND_DEFINITIONS = {
  'auction.expire': {
    version: 1,
    subject: `${BACKGROUND_COMMAND_SUBJECT_PREFIX}.auction-expire.v1`,
    scheduleBucketMs: 2 * 60_000,
  },
  'bet-battle.expire': {
    version: 1,
    subject: `${BACKGROUND_COMMAND_SUBJECT_PREFIX}.bet-battle-expire.v1`,
    scheduleBucketMs: 2 * 60_000,
  },
  'ranking.rewards.distribute': {
    version: 1,
    subject: `${BACKGROUND_COMMAND_SUBJECT_PREFIX}.ranking-rewards-distribute.v1`,
    scheduleBucketMs: 24 * 60 * 60_000,
  },
  'market.refresh': {
    version: 1,
    subject: `${BACKGROUND_COMMAND_SUBJECT_PREFIX}.market-refresh.v1`,
    scheduleBucketMs: 5 * 60_000,
  },
  'tower.enemy-sets.refresh': {
    version: 1,
    subject: `${BACKGROUND_COMMAND_SUBJECT_PREFIX}.tower-enemy-sets-refresh.v1`,
    scheduleBucketMs: 60 * 60_000,
  },
  'resource-replay.cleanup': {
    version: 1,
    subject: `${BACKGROUND_COMMAND_SUBJECT_PREFIX}.resource-replay-cleanup.v1`,
    scheduleBucketMs: 24 * 60 * 60_000,
  },
  'expired-data.cleanup': {
    version: 1,
    subject: `${BACKGROUND_COMMAND_SUBJECT_PREFIX}.expired-data-cleanup.v1`,
    scheduleBucketMs: 24 * 60 * 60_000,
  },
  'material-library.generate': {
    version: 1,
    subject: `${BACKGROUND_COMMAND_SUBJECT_PREFIX}.material-library-generate.v1`,
    scheduleBucketMs: 24 * 60 * 60_000,
  },
  'sponsorship.reconcile': {
    version: 1,
    subject: `${BACKGROUND_COMMAND_SUBJECT_PREFIX}.sponsorship-reconcile.v1`,
    scheduleBucketMs: 10 * 60_000,
  },
  'sponsorship.deep-reconcile': {
    version: 1,
    subject: `${BACKGROUND_COMMAND_SUBJECT_PREFIX}.sponsorship-deep-reconcile.v1`,
    scheduleBucketMs: 24 * 60 * 60_000,
  },
  'sponsorship.cleanup': {
    version: 1,
    subject: `${BACKGROUND_COMMAND_SUBJECT_PREFIX}.sponsorship-cleanup.v1`,
    scheduleBucketMs: 24 * 60 * 60_000,
  },
  'sponsorship.admin-digest': {
    version: 1,
    subject: `${BACKGROUND_COMMAND_SUBJECT_PREFIX}.sponsorship-admin-digest.v1`,
    scheduleBucketMs: 24 * 60 * 60_000,
  },
} as const satisfies Record<
  BackgroundCommandType,
  { version: number; subject: string; scheduleBucketMs: number }
>;

const BackgroundCommandEnvelopeSchema = z
  .object({
    id: z.uuid(),
    type: z.enum(BACKGROUND_COMMAND_TYPES),
    version: z.number().int().positive(),
    subject: z.string().min(1).max(160),
    requestedAt: z.string().datetime(),
    scheduleBucketStartedAt: z.string().datetime(),
    deduplicationKey: z.string().min(1).max(256),
  })
  .strict();

export type BackgroundCommandEnvelope = z.infer<
  typeof BackgroundCommandEnvelopeSchema
>;

export function parseBackgroundCommandEnvelope(
  input: unknown,
): BackgroundCommandEnvelope {
  const command = BackgroundCommandEnvelopeSchema.parse(input);
  const definition = BACKGROUND_COMMAND_DEFINITIONS[command.type];
  if (
    command.version !== definition.version ||
    command.subject !== definition.subject
  ) {
    throw new Error(
      `后台命令定义不匹配: ${command.type}@v${command.version} subject=${command.subject}`,
    );
  }
  return command;
}
