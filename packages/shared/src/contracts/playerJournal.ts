import type {
  BreakthroughResult,
  CultivationResult,
} from '@daoyou/shared/engine/cultivation/CultivationEngine';
import { REALM_STAGE_VALUES, REALM_VALUES } from '@daoyou/shared/types/constants';
import { z } from 'zod';
import type { RetreatResultData } from './retreat.js';

const amount = z.number().nonnegative();
const cultivationSummary = z.object({
  exp_gained: amount,
  exp_before: amount,
  exp_after: amount,
  insight_gained: amount,
  epiphany_triggered: z.boolean(),
  bottleneck_entered: z.boolean(),
  can_breakthrough: z.boolean(),
  progress: amount,
}) satisfies z.ZodType<CultivationResult['summary']>;

const breakthroughSummary = z.object({
  success: z.boolean(),
  chance: z.number(),
  roll: z.number(),
  fromRealm: z.enum(REALM_VALUES),
  fromStage: z.enum(REALM_STAGE_VALUES),
  toRealm: z.enum(REALM_VALUES).optional(),
  toStage: z.enum(REALM_STAGE_VALUES).optional(),
  lifespanGained: amount,
  attributeGrowth: z.object({
    vitality: z.number().optional(),
    strength: z.number().optional(),
    spirit: z.number().optional(),
    endurance: z.number().optional(),
    speed: z.number().optional(),
    willpower: z.number().optional(),
  }),
  naturalAttributeGrowth: amount,
  attributePointReward: amount,
  exp_progress: amount,
  insight_value: amount,
  exp_lost: amount.optional(),
  breakthrough_type: z.enum(['forced', 'normal', 'perfect']),
  insight_change: z.number(),
  inner_demon_triggered: z.boolean(),
  modifiers: z.object({
    baseChance: z.number(),
    realmDifficulty: z.number(),
    progressMultiplier: z.number(),
    insightMultiplier: z.number(),
    demonPenalty: z.number(),
    adjustedBaseChance: z.number(),
    fateBonus: z.number(),
    pillBonus: z.number(),
    toxicityPenalty: z.number(),
    finalChance: z.number(),
  }),
}) satisfies z.ZodType<BreakthroughResult['summary']>;

export const JOURNAL_ACTIVITIES = {
  wild_settlement: '野外战斗',
  hunt_reward: '组队讨伐',
  yield_claim: '领取历练收益',
  mail_claim: '领取邮件',
  mail_claim_all: '批量领取邮件',
  player_mail_send: '发送传音',
  market_purchase_v6: '坊市购买',
  black_market_purchase: '黑市购买',
  reputation_shop_buy: '声望兑换',
  bag_recycle: '回收道具',
  alchemy_formula: '按方炼丹',
  alchemy_improvised: '即兴炼丹',
  forging: '炼器',
  manual_enlightenment: '功法参悟',
  spirit_field_starter: '领取灵种',
  spirit_field_sow: '灵田播种',
  spirit_field_cultivate: '灵田培育',
  spirit_field_harvest: '灵田收获',
  sect_task_action: '宗门任务',
  sect_battle_settlement: '宗门任务战斗',
  sect_shop_purchase: '宗门兑换',
  sect_construction_donate: '宗门建设',
  sect_stipend_claim: '领取俸禄',
} as const;
export type JournalActivity = keyof typeof JOURNAL_ACTIVITIES;
export const JournalActivitySchema = z.enum(
  Object.keys(JOURNAL_ACTIVITIES) as [JournalActivity, ...JournalActivity[]],
);
export const JournalChangeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('resource'),
    resource: z.enum([
      'spiritStones',
      'exp',
      'insight',
      'reputation',
      'contribution',
    ]),
    amount: z.number().refine((value) => value !== 0),
  }),
  z.object({
    kind: z.literal('item'),
    id: z.string(),
    name: z.string(),
    amount: z
      .number()
      .int()
      .refine((value) => value !== 0),
  }),
]);
export type JournalChange = z.infer<typeof JournalChangeSchema>;

export const PlayerJournalEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('resources.settled'),
    activity: JournalActivitySchema,
    detail: z.string().optional(),
    changes: z.array(JournalChangeSchema),
  }),
  z.object({
    type: z.literal('retreat.completed'),
    years: z.number().int().min(1).max(200),
    qiSpent: amount,
    summary: cultivationSummary,
    depleted: z.boolean(),
  }),
  z.object({
    type: z.literal('breakthrough.completed'),
    qiSpent: amount,
    expSpent: amount,
    summary: breakthroughSummary,
  }),
]);

export type PlayerJournalEvent = z.infer<typeof PlayerJournalEventSchema>;

// Execution results stay in storage; the public event parser strips them.
export const StoredJournalEventSchema = PlayerJournalEventSchema.and(
  z.object({ result: z.unknown().optional() }),
);
export type StoredJournalEvent = z.infer<typeof StoredJournalEventSchema>;

/** Replay the committed result without rerunning settlement or story generation. */
export function retreatResultFromJournal(
  event: PlayerJournalEvent,
): RetreatResultData {
  if (event.type === 'resources.settled') throw new Error('非闭关突破执行记录');
  return event.type === 'retreat.completed'
    ? { action: 'cultivate', summary: event.summary, depleted: event.depleted }
    : { action: 'breakthrough', summary: event.summary };
}

export const JournalCursorSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.uuid(),
});
export type JournalCursor = z.infer<typeof JournalCursorSchema>;

export const PlayerJournalQuerySchema = z
  .object({
    type: z
      .enum([
        'retreat.completed',
        'breakthrough.completed',
        'resources.settled',
      ])
      .optional(),
    activity: JournalActivitySchema.optional(),
    before: z.iso.datetime().optional(),
    beforeId: z.uuid().optional(),
  })
  .refine((value) => Boolean(value.before) === Boolean(value.beforeId), {
    message: '分页游标不完整',
  });

export interface PlayerJournalPage {
  items: { id: string; event: PlayerJournalEvent; createdAt: string }[];
  nextCursor: JournalCursor | null;
}

export const JournalRequestSchema = z.object({ requestId: z.uuid() }).strict();
