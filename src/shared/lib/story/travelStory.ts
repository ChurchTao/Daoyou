import { YieldCalculator } from '@shared/engine/yield/YieldCalculator';
import {
  REALM_STAGE_VALUES,
  REALM_VALUES,
  type RealmStage,
  type RealmType,
} from '@shared/types/constants';
import * as z from 'zod';

export const TRAVEL_STORY_EVENT_TYPE_VALUES = [
  'memory_echo',
  'roadside_encounter',
  'wild_omen',
] as const;
export const TravelStoryEventTypeSchema = z.enum(
  TRAVEL_STORY_EVENT_TYPE_VALUES,
);
export type TravelStoryEventType = z.infer<typeof TravelStoryEventTypeSchema>;

export const ACTIVITY_STORY_ACTIVITY_TYPE_VALUES = [
  'travel',
  'sect_task',
  'dungeon',
] as const;
export const ActivityStoryActivityTypeSchema = z.enum(
  ACTIVITY_STORY_ACTIVITY_TYPE_VALUES,
);
export type ActivityStoryActivityType = z.infer<
  typeof ActivityStoryActivityTypeSchema
>;

export const ACTIVITY_STORY_DECISION_VALUES = [
  'travel_short',
  'dungeon_short',
  'sect_task_short',
  'mainline_omen',
  'sect_mainline',
  'mainline_dungeon',
] as const;
export const ActivityStoryDecisionSchema = z.enum(
  ACTIVITY_STORY_DECISION_VALUES,
);
export type ActivityStoryDecision = z.infer<typeof ActivityStoryDecisionSchema>;

export const ACTIVITY_STORY_DIRECTOR_PRIORITY: Record<
  ActivityStoryDecision,
  number
> = {
  travel_short: 10,
  dungeon_short: 20,
  sect_task_short: 30,
  mainline_omen: 90,
  sect_mainline: 95,
  mainline_dungeon: 100,
};

export const TRAVEL_STORY_CHOICE_KEY_VALUES = [
  'approach_carefully',
  'act_decisively',
] as const;
export const TravelStoryChoiceKeySchema = z.enum(
  TRAVEL_STORY_CHOICE_KEY_VALUES,
);
export type TravelStoryChoiceKey = z.infer<typeof TravelStoryChoiceKeySchema>;

export const TRAVEL_STORY_REWARD_KIND_VALUES = [
  'spirit_stones',
  'cultivation_exp',
  'comprehension_insight',
] as const;
export const TravelStoryRewardKindSchema = z.enum(
  TRAVEL_STORY_REWARD_KIND_VALUES,
);
export type TravelStoryRewardKind = z.infer<typeof TravelStoryRewardKindSchema>;

export const TRAVEL_STORY_LINK_KIND_VALUES = [
  'mainline_prelude',
  'mainline_echo',
] as const;
export const TravelStoryLinkKindSchema = z.enum(TRAVEL_STORY_LINK_KIND_VALUES);
export type TravelStoryLinkKind = z.infer<typeof TravelStoryLinkKindSchema>;

export const TravelStoryLinkSchema = z
  .object({
    kind: TravelStoryLinkKindSchema,
    threadId: z.string().uuid(),
    anchorIntentId: z.string().uuid().optional(),
    dungeonRunId: z.string().uuid().optional(),
  })
  .strict();
export type TravelStoryLink = z.infer<typeof TravelStoryLinkSchema>;

export const TRAVEL_STORY_REWARD_LABELS: Record<TravelStoryRewardKind, string> =
  {
    spirit_stones: '灵石',
    cultivation_exp: '修为',
    comprehension_insight: '感悟',
  };

export const TravelStoryChoiceGenerationSchema = z
  .object({
    key: TravelStoryChoiceKeySchema,
    label: z.string().trim().min(2).max(20),
    description: z.string().trim().min(6).max(120),
    outcome: z.string().trim().min(12).max(600),
    memorySummary: z.string().trim().min(12).max(240),
    tags: z.array(z.string().trim().min(1).max(20)).min(1).max(6),
    rewardKind: TravelStoryRewardKindSchema,
  })
  .strict();
export type TravelStoryChoiceGeneration = z.infer<
  typeof TravelStoryChoiceGenerationSchema
>;

export const TravelStoryGenerationSchema = z
  .object({
    eventType: TravelStoryEventTypeSchema,
    title: z.string().trim().min(4).max(60),
    content: z.string().trim().min(40).max(1_200),
    memoryRefs: z.array(z.string().uuid()).max(6),
    entityRefs: z.array(z.string().uuid()).max(3),
    continuityClaims: z.array(z.string().trim().min(4).max(160)).max(6),
    choices: z.array(TravelStoryChoiceGenerationSchema).length(2),
  })
  .strict()
  .superRefine((value, context) => {
    const keys = value.choices.map((choice) => choice.key);
    if (
      new Set(keys).size !== TRAVEL_STORY_CHOICE_KEY_VALUES.length ||
      TRAVEL_STORY_CHOICE_KEY_VALUES.some((key) => !keys.includes(key))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['choices'],
        message: '云游事件必须各包含一次谨慎接近和果断行动',
      });
    }
  });
export type TravelStoryGeneration = z.infer<typeof TravelStoryGenerationSchema>;

export const TravelStoryRewardSchema = z
  .object({
    type: TravelStoryRewardKindSchema,
    value: z.number().int().positive(),
  })
  .strict();
export type TravelStoryReward = z.infer<typeof TravelStoryRewardSchema>;

export const TravelStoryIntentPayloadSchema = z
  .object({
    kind: z.enum(['travel_event', 'activity_story']),
    eventType: TravelStoryEventTypeSchema,
    title: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1).max(4_000),
    memoryRefs: z.array(z.string().uuid()).max(6),
    entityRefs: z.array(z.string().uuid()).max(3),
    continuityClaims: z.array(z.string().trim().min(1).max(200)).max(6),
    choices: z.array(TravelStoryChoiceGenerationSchema).length(2),
    source: z
      .object({
        actionInstanceId: z.string().uuid(),
        hours: z.number().min(1).max(24),
        realm: z.enum(REALM_VALUES),
        realmStage: z.enum(REALM_STAGE_VALUES),
        activityType: ActivityStoryActivityTypeSchema.default('travel'),
        activityId: z.string().trim().min(1).max(160).optional(),
        rootActivityId: z.string().trim().min(1).max(160).optional(),
        title: z.string().trim().min(1).max(100).optional(),
        summary: z.string().trim().min(1).max(500).optional(),
      })
      .strict(),
    linkage: TravelStoryLinkSchema.optional(),
    director: z
      .object({
        decision: ActivityStoryDecisionSchema,
        priority: z.number().int().min(0).max(1_000),
        rootActivityId: z.string().trim().min(1).max(160),
        sourceEventId: z.string().uuid(),
      })
      .strict()
      .optional(),
    selectedChoiceKey: TravelStoryChoiceKeySchema.optional(),
    selectedOutcome: z.string().trim().min(1).max(1_200).optional(),
    selectedReward: TravelStoryRewardSchema.optional(),
  })
  .strict();
export type TravelStoryIntentPayload = z.infer<
  typeof TravelStoryIntentPayloadSchema
>;

const TravelStoryChoicePreviewSchema = TravelStoryChoiceGenerationSchema.pick({
  key: true,
  label: true,
  description: true,
  rewardKind: true,
});

export const TravelStoryEventSchema = z
  .object({
    id: z.string().uuid(),
    eventType: TravelStoryEventTypeSchema,
    activityType: ActivityStoryActivityTypeSchema.default('travel'),
    title: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1).max(4_000),
    choices: z.array(TravelStoryChoicePreviewSchema).length(2),
    status: z.enum(['awaiting_choice', 'resolved']),
    selectedChoiceKey: TravelStoryChoiceKeySchema.optional(),
    selectedOutcome: z.string().trim().min(1).max(1_200).optional(),
    selectedReward: TravelStoryRewardSchema.optional(),
    linkage: TravelStoryLinkSchema.optional(),
    createdAt: z.string().datetime(),
  })
  .strict();
export type TravelStoryEvent = z.infer<typeof TravelStoryEventSchema>;

export const TRAVEL_STORY_MIN_HOURS = 4;
export const TRAVEL_STORY_GUARANTEED_HOURS = 20;
export const TRAVEL_STORY_COOLDOWN_MS = 12 * 60 * 60 * 1_000;
export const TRAVEL_STORY_DEFAULT_CHANCE = 0.35;
export const TRAVEL_STORY_REWARD_MULTIPLIER = 0.25;
export const ACTIVITY_STORY_REWARD_MULTIPLIERS: Record<
  ActivityStoryActivityType,
  number
> = {
  travel: 0.25,
  sect_task: 0.15,
  dungeon: 0.2,
};
export const ACTIVITY_STORY_REWARD_CAP_MULTIPLIER = 0.25;

export function travelStoryMainlineDangerAdjustment(
  choiceKey: TravelStoryChoiceKey,
): number {
  return choiceKey === 'approach_carefully' ? -5 : 5;
}

export function combineStoryDangerAdjustments(...values: number[]): number {
  return Math.max(
    -10,
    Math.min(
      10,
      values.reduce((sum, value) => sum + value, 0),
    ),
  );
}

function deterministicChance(seed: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) / 0x1_0000_0000;
}

export function shouldGenerateTravelStoryEvent(input: {
  hours: number;
  actionInstanceId: string;
  hasPendingEvent: boolean;
  lastEventAt?: Date | null;
  now?: Date;
  chance?: number;
  minHours?: number;
}): boolean {
  if (input.hasPendingEvent) return false;
  const minHours = input.minHours ?? TRAVEL_STORY_MIN_HOURS;
  if (input.hours < minHours) return false;
  const now = input.now ?? new Date();
  if (
    input.lastEventAt &&
    now.getTime() - input.lastEventAt.getTime() < TRAVEL_STORY_COOLDOWN_MS
  ) {
    return false;
  }
  if (input.hours >= TRAVEL_STORY_GUARANTEED_HOURS) return true;
  const chance = Math.min(
    1,
    Math.max(0, input.chance ?? TRAVEL_STORY_DEFAULT_CHANCE),
  );
  return deterministicChance(input.actionInstanceId) < chance;
}

export function calculateTravelStoryReward(input: {
  realm: RealmType;
  realmStage: RealmStage;
  hours: number;
  rewardKind: TravelStoryRewardKind;
  activityType?: ActivityStoryActivityType;
}): TravelStoryReward {
  const standardYield = YieldCalculator.calculateCultivatorYield(
    {
      realm: input.realm,
      realmStage: input.realmStage,
      hoursElapsed: Math.min(24, Math.max(1, input.hours)),
    },
    () => 0.5,
  );
  const standardValue =
    standardYield.find((operation) => operation.type === input.rewardKind)
      ?.value ?? 1;
  return {
    type: input.rewardKind,
    value: Math.max(
      1,
      Math.min(
        Math.floor(
          standardValue *
            ACTIVITY_STORY_REWARD_MULTIPLIERS[input.activityType ?? 'travel'],
        ),
        Math.max(
          1,
          Math.floor(standardValue * ACTIVITY_STORY_REWARD_CAP_MULTIPLIER),
        ),
      ),
    ),
  };
}

export function isActivityStoryRewardWithinBudget(input: {
  realm: RealmType;
  realmStage: RealmStage;
  hours: number;
  activityType: ActivityStoryActivityType;
  reward: TravelStoryReward;
}): boolean {
  const maximum = calculateTravelStoryReward({
    realm: input.realm,
    realmStage: input.realmStage,
    hours: input.hours,
    rewardKind: input.reward.type,
    activityType: input.activityType,
  });
  return input.reward.value > 0 && input.reward.value <= maximum.value;
}

export function chooseActivityStoryDirectorDecision(
  candidates: readonly ActivityStoryDecision[],
): ActivityStoryDecision | null {
  return (
    [...candidates].sort(
      (left, right) =>
        ACTIVITY_STORY_DIRECTOR_PRIORITY[right] -
          ACTIVITY_STORY_DIRECTOR_PRIORITY[left] || left.localeCompare(right),
    )[0] ?? null
  );
}

export function shouldReplaceActivityStoryDecision(input: {
  current: ActivityStoryDecision;
  candidate: ActivityStoryDecision;
  currentResolved?: boolean;
}): boolean {
  return (
    !input.currentResolved &&
    ACTIVITY_STORY_DIRECTOR_PRIORITY[input.candidate] >
      ACTIVITY_STORY_DIRECTOR_PRIORITY[input.current]
  );
}

export function isActivityStoryOwnedByCultivator(input: {
  ownerCultivatorId: string;
  requestedCultivatorId: string;
}): boolean {
  return input.ownerCultivatorId === input.requestedCultivatorId;
}
