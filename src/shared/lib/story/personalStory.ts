import * as z from 'zod';
import { TravelStoryChoiceKeySchema } from './travelStory';

export const PERSONAL_STORY_FRAMEWORK_ID = 'past_echoes' as const;
export const PERSONAL_STORY_FRAMEWORK_VERSION = 1 as const;
export const PERSONAL_STORY_FRAMEWORK_TITLE = '前尘回响' as const;

export const STORY_THREAD_SCOPE_VALUES = ['personal', 'sect'] as const;
export const StoryThreadScopeSchema = z.enum(STORY_THREAD_SCOPE_VALUES);
export type StoryThreadScope = z.infer<typeof StoryThreadScopeSchema>;

export const STORY_THREAD_STAGE_VALUES = [
  'omen',
  'choice',
  'travel_prelude',
  'confrontation',
  'aftermath',
  'resolved',
] as const;
export const StoryThreadStageSchema = z.enum(STORY_THREAD_STAGE_VALUES);
export type StoryThreadStage = z.infer<typeof StoryThreadStageSchema>;

export const STORY_THREAD_STATUS_VALUES = [
  'active',
  'paused',
  'resolved',
  'failed',
] as const;
export const StoryThreadStatusSchema = z.enum(STORY_THREAD_STATUS_VALUES);
export type StoryThreadStatus = z.infer<typeof StoryThreadStatusSchema>;

export const STORY_BEAT_TYPE_VALUES = [
  'omen',
  'aftermath',
  'travel_event',
  'activity_story',
  'travel_prelude',
  'travel_echo',
] as const;
export const StoryBeatTypeSchema = z.enum(STORY_BEAT_TYPE_VALUES);
export type StoryBeatType = z.infer<typeof StoryBeatTypeSchema>;

export const STORY_INTENT_STATUS_VALUES = [
  'ready',
  'delivered',
  'resolved',
  'failed',
] as const;
export const StoryIntentStatusSchema = z.enum(STORY_INTENT_STATUS_VALUES);
export type StoryIntentStatus = z.infer<typeof StoryIntentStatusSchema>;

export const STORY_CHOICE_KEY_VALUES = [
  'intervene_now',
  'investigate_first',
  'delay',
] as const;
export const STORY_LAUNCH_CHOICE_KEY_VALUES = [
  'intervene_now',
  'investigate_first',
] as const;
export const StoryChoiceKeySchema = z.enum(STORY_CHOICE_KEY_VALUES);
export type StoryChoiceKey = z.infer<typeof StoryChoiceKeySchema>;
export const StoryLaunchChoiceKeySchema = z.enum(
  STORY_LAUNCH_CHOICE_KEY_VALUES,
);
export type StoryLaunchChoiceKey = z.infer<typeof StoryLaunchChoiceKeySchema>;

export const STORY_ENTITY_LIFE_STATUS_VALUES = [
  'active',
  'dead',
  'missing',
  'sealed',
] as const;
export const StoryEntityLifeStatusSchema = z.enum(
  STORY_ENTITY_LIFE_STATUS_VALUES,
);
export type StoryEntityLifeStatus = z.infer<typeof StoryEntityLifeStatusSchema>;

export const StoryEntityIntroductionModeSchema = z.enum([
  'unverified_claimant',
  'established',
]);
export type StoryEntityIntroductionMode = z.infer<
  typeof StoryEntityIntroductionModeSchema
>;

export const StoryAftermathNarratorModeSchema = z.enum([
  'entity_letter',
  'system_record',
  'pre_recorded_message',
]);
export type StoryAftermathNarratorMode = z.infer<
  typeof StoryAftermathNarratorModeSchema
>;

export const StoryResolutionStatusSchema = z.enum([
  'resolved',
  'partial',
  'failed',
]);
export type StoryResolutionStatus = z.infer<typeof StoryResolutionStatusSchema>;

export const StoryChoiceSchema = z
  .object({
    key: StoryChoiceKeySchema,
    label: z.string().trim().min(2).max(20),
    description: z.string().trim().min(4).max(100),
  })
  .strict();
export type StoryChoice = z.infer<typeof StoryChoiceSchema>;

const StoryEntityDraftSchema = z
  .object({
    name: z.string().trim().min(2).max(40),
    entityType: z.enum(['person', 'spirit', 'faction']),
    state: z.string().trim().min(2).max(120),
    relationship: z.enum(['unknown', 'neutral', 'trusting', 'wary', 'hostile']),
    introductionMode: StoryEntityIntroductionModeSchema,
  })
  .strict();

export const StoryMemoryGenerationSchema = z
  .object({
    summary: z.string().trim().min(12).max(240),
    tags: z.array(z.string().trim().min(1).max(20)).min(1).max(6),
    importance: z.number().int().min(1).max(5),
  })
  .strict();
export type StoryMemoryGeneration = z.infer<typeof StoryMemoryGenerationSchema>;

export const StoryOmenGenerationSchema = z
  .object({
    title: z.string().trim().min(4).max(60),
    content: z.string().trim().min(40).max(1_200),
    premise: z.string().trim().min(12).max(300),
    unresolvedQuestion: z.string().trim().min(8).max(200),
    memoryRefs: z.array(z.string().uuid()).min(1).max(6),
    continuityClaims: z.array(z.string().trim().min(4).max(160)).max(6),
    entity: StoryEntityDraftSchema,
    choices: z.array(StoryChoiceSchema).length(2),
  })
  .strict()
  .superRefine((value, context) => {
    const keys = value.choices.map((choice) => choice.key);
    if (
      new Set(keys).size !== STORY_LAUNCH_CHOICE_KEY_VALUES.length ||
      STORY_LAUNCH_CHOICE_KEY_VALUES.some((key) => !keys.includes(key))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['choices'],
        message: '剧情选择必须各包含一次立即介入和先行调查',
      });
    }
  });
export type StoryOmenGeneration = z.infer<typeof StoryOmenGenerationSchema>;

export const StoryDungeonBlueprintSchema = z
  .object({
    title: z.string().trim().min(4).max(60),
    theme: z.string().trim().min(8).max(160),
    objective: z.string().trim().min(8).max(160),
    openingHook: z.string().trim().min(12).max(300),
    primaryClue: z.string().trim().min(4).max(120),
    dangerTone: z.enum(['urgent', 'measured', 'cautious']),
  })
  .strict();
export type StoryDungeonBlueprint = z.infer<typeof StoryDungeonBlueprintSchema>;

export const StoryAftermathGenerationSchema = z
  .object({
    title: z.string().trim().min(4).max(60),
    content: z.string().trim().min(40).max(1_200),
    memorySummary: z.string().trim().min(12).max(240),
    entityState: z.string().trim().min(4).max(120),
    relationship: z.enum(['neutral', 'trusting', 'wary', 'hostile']),
    resolutionStatus: StoryResolutionStatusSchema,
    narratorMode: StoryAftermathNarratorModeSchema,
    nextHook: z.string().trim().max(200),
    continuityClaims: z.array(z.string().trim().min(4).max(160)).max(6),
  })
  .strict();
export type StoryAftermathGeneration = z.infer<
  typeof StoryAftermathGenerationSchema
>;

export const StoryIntentPayloadSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1).max(4_000),
    memoryRefs: z.array(z.string().uuid()).max(6).default([]),
    entityRefs: z.array(z.string().uuid()).max(3).default([]),
    continuityClaims: z.array(z.string().max(200)).max(6).default([]),
    choices: z.array(StoryChoiceSchema).max(3).default([]),
    selectedChoiceKey: StoryChoiceKeySchema.optional(),
    dungeonBlueprint: StoryDungeonBlueprintSchema.optional(),
    entityIntroductionMode: StoryEntityIntroductionModeSchema.optional(),
    resolutionStatus: StoryResolutionStatusSchema.optional(),
    narratorMode: StoryAftermathNarratorModeSchema.optional(),
    nextHook: z.string().trim().max(200).optional(),
  })
  .strict();
export type StoryIntentPayload = z.infer<typeof StoryIntentPayloadSchema>;

export const StoryThreadLinkageContextSchema = z
  .object({
    prelude: z
      .object({
        intentId: z.string().uuid(),
        choiceKey: TravelStoryChoiceKeySchema,
        outcome: z.string().trim().min(1).max(1_200),
        dangerAdjustment: z.number().int().min(-5).max(5),
      })
      .strict()
      .optional(),
    dungeon: z
      .object({
        runId: z.string().uuid(),
        outcome: StoryResolutionStatusSchema,
        settledAt: z.string().datetime(),
        summary: z.string().trim().min(1).max(240).optional(),
      })
      .strict()
      .optional(),
    echo: z
      .object({
        intentId: z.string().uuid(),
        availableAt: z.string().datetime(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type StoryThreadLinkageContext = z.infer<
  typeof StoryThreadLinkageContextSchema
>;

export const DungeonStoryContextSchema = z
  .object({
    threadId: z.string().uuid(),
    intentId: z.string().uuid(),
    frameworkId: z.literal(PERSONAL_STORY_FRAMEWORK_ID),
    title: z.string().trim().min(1).max(80),
    premise: z.string().trim().min(1).max(300),
    choiceKey: StoryChoiceKeySchema.exclude(['delay']),
    entryMode: z.enum(['direct', 'investigated']),
    objective: z.string().trim().min(1).max(160),
    openingHook: z.string().trim().min(1).max(300),
    primaryClue: z.string().trim().min(1).max(120),
    initialDangerAdjustment: z.number().int().min(-10).max(10),
    entryAdvantage: z.enum(['initiative', 'prepared_clue']).optional(),
    entryConsequence: z.enum(['higher_danger', 'target_prepared']).optional(),
    travelChoiceKey: TravelStoryChoiceKeySchema,
    travelOutcome: z.string().trim().min(1).max(1_200),
    travelDangerAdjustment: z.number().int().min(-5).max(5),
  })
  .strict();
export type DungeonStoryContext = z.infer<typeof DungeonStoryContextSchema>;

export const StoryMailDescriptorSchema = z
  .object({
    intentId: z.string().uuid(),
    threadId: z.string().uuid(),
    frameworkId: z.literal(PERSONAL_STORY_FRAMEWORK_ID),
    frameworkTitle: z.literal(PERSONAL_STORY_FRAMEWORK_TITLE),
    beatType: StoryBeatTypeSchema,
    status: StoryIntentStatusSchema,
    threadStatus: StoryThreadStatusSchema,
    choices: z.array(StoryChoiceSchema).max(3),
    selectedChoiceKey: StoryChoiceKeySchema.optional(),
    canStartDungeon: z.boolean(),
    awaitingTravelPrelude: z.boolean(),
    linkedMapNodeId: z.string().max(100).optional(),
  })
  .strict();
export type StoryMailDescriptor = z.infer<typeof StoryMailDescriptorSchema>;

export const STORY_ARCHIVE_PROGRESS_KEY_VALUES = [
  'awaiting_delivery',
  'awaiting_choice',
  'awaiting_travel_prelude',
  'ready_to_start',
  'in_dungeon',
  'awaiting_echo',
  'resolving',
  'resolved',
  'failed',
] as const;
export const StoryArchiveProgressKeySchema = z.enum(
  STORY_ARCHIVE_PROGRESS_KEY_VALUES,
);

export const StoryArchiveProgressSchema = z
  .object({
    key: StoryArchiveProgressKeySchema,
    label: z.string().trim().min(1).max(40),
    nextAction: z.string().trim().min(1).max(120),
    stepIndex: z.number().int().min(1).max(5),
  })
  .strict();
export type StoryArchiveProgress = z.infer<typeof StoryArchiveProgressSchema>;

const StoryArchiveBeatSchema = z
  .object({
    type: StoryBeatTypeSchema,
    title: z.string().trim().min(1).max(200),
    content: z.string().trim().min(1).max(4_000),
    createdAt: z.string().datetime(),
  })
  .strict();

const StoryArchiveEntitySchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(80),
    state: z.string().trim().min(1).max(500),
    relationship: z.string().trim().min(1).max(24),
    lifeStatus: StoryEntityLifeStatusSchema,
  })
  .strict();

const StoryArchiveRunSchema = z
  .object({
    id: z.string().uuid(),
    status: z.string().trim().min(1).max(40),
    currentRound: z.number().int().min(1),
    maxRounds: z.number().int().min(1),
  })
  .strict();

export const StoryArchiveEntrySchema = z
  .object({
    id: z.string().uuid(),
    frameworkTitle: z.literal(PERSONAL_STORY_FRAMEWORK_TITLE),
    threadScope: StoryThreadScopeSchema,
    title: z.string().trim().min(1).max(200),
    premise: z.string().trim().min(1).max(500),
    status: StoryThreadStatusSchema,
    stage: StoryThreadStageSchema,
    isCurrent: z.boolean(),
    progress: StoryArchiveProgressSchema,
    selectedChoiceKey: StoryChoiceKeySchema.optional(),
    selectedChoiceLabel: z.string().trim().min(1).max(40).optional(),
    nextHook: z.string().trim().max(500),
    entities: z.array(StoryArchiveEntitySchema).max(3),
    beats: z.array(StoryArchiveBeatSchema).max(4),
    linkedRun: StoryArchiveRunSchema.optional(),
    createdAt: z.string().datetime(),
    resolvedAt: z.string().datetime().optional(),
  })
  .strict();
export type StoryArchiveEntry = z.infer<typeof StoryArchiveEntrySchema>;

export const StoryArchiveResponseSchema = z
  .object({
    current: StoryArchiveEntrySchema.nullable(),
    currentPersonal: StoryArchiveEntrySchema.nullable(),
    currentSect: StoryArchiveEntrySchema.nullable(),
    history: z.array(StoryArchiveEntrySchema).max(30),
    total: z.number().int().nonnegative(),
  })
  .strict();
export type StoryArchiveResponse = z.infer<typeof StoryArchiveResponseSchema>;

const ALLOWED_STAGE_TRANSITIONS: Record<StoryThreadStage, StoryThreadStage[]> =
  {
    omen: ['choice'],
    choice: ['travel_prelude'],
    travel_prelude: ['confrontation'],
    confrontation: ['aftermath'],
    aftermath: ['resolved'],
    resolved: [],
  };

export function canAdvanceStoryStage(
  from: StoryThreadStage,
  to: StoryThreadStage,
): boolean {
  return ALLOWED_STAGE_TRANSITIONS[from].includes(to);
}

export function storyChoiceLaunchRules(choiceKey: StoryChoiceKey): {
  entryMode: DungeonStoryContext['entryMode'] | null;
  initialDangerAdjustment: number;
  entryAdvantage?: NonNullable<DungeonStoryContext['entryAdvantage']>;
  entryConsequence?: NonNullable<DungeonStoryContext['entryConsequence']>;
} {
  switch (choiceKey) {
    case 'intervene_now':
      return {
        entryMode: 'direct',
        initialDangerAdjustment: 10,
        entryAdvantage: 'initiative',
        entryConsequence: 'higher_danger',
      };
    case 'investigate_first':
      return {
        entryMode: 'investigated',
        initialDangerAdjustment: -5,
        entryAdvantage: 'prepared_clue',
        entryConsequence: 'target_prepared',
      };
    case 'delay':
      return { entryMode: null, initialDangerAdjustment: 0 };
  }
}

export function deriveStoryArchiveProgress(input: {
  stage: StoryThreadStage;
  status: StoryThreadStatus;
  linkedRunId?: string | null;
  linkedRunStatus?: string | null;
}): StoryArchiveProgress {
  if (input.status === 'failed') {
    return {
      key: 'failed',
      label: '此章未竟',
      nextAction: '这段故事已经终止，可在历史卷宗中复盘已发生的部分。',
      stepIndex: 5,
    };
  }
  if (input.status === 'resolved' || input.stage === 'resolved') {
    return {
      key: 'resolved',
      label: '此章已归档',
      nextAction: '当前冲突已收束，往后只有相关事件才会再度唤起这段旧事。',
      stepIndex: 5,
    };
  }
  if (input.stage === 'omen') {
    return {
      key: 'awaiting_delivery',
      label: '来信整理中',
      nextAction: '重要剧情信正在整理，完成投递后即可查看这段旧事的开端。',
      stepIndex: 1,
    };
  }
  if (input.stage === 'choice' || input.status === 'paused') {
    return {
      key: 'awaiting_choice',
      label: '等待抉择',
      nextAction: '打开重要剧情信，选择立即介入或先行调查。',
      stepIndex: 2,
    };
  }
  if (input.stage === 'travel_prelude') {
    return {
      key: 'awaiting_travel_prelude',
      label: '途中线索待查',
      nextAction: '回到洞府首页，处理与这封信相连的云游异闻。',
      stepIndex: 3,
    };
  }
  if (input.stage === 'confrontation' && !input.linkedRunId) {
    return {
      key: 'ready_to_start',
      label: '关联秘境已备妥',
      nextAction: '回到剧情信，由信中入口开启这次关联秘境。',
      stepIndex: 4,
    };
  }
  if (input.stage === 'aftermath' || input.linkedRunStatus === 'FINISHED') {
    return {
      key: 'awaiting_echo',
      label: '延迟回响待应',
      nextAction: '秘境结局已经留下余波，待回响出现后作出最后回应。',
      stepIndex: 5,
    };
  }
  return {
    key: 'in_dungeon',
    label: '关联秘境进行中',
    nextAction: '继续当前关联秘境，直到核心冲突得到结果。',
    stepIndex: 4,
  };
}

const UNVERIFIED_RELATION_MARKERS =
  /自称|声称|或许|可能|似乎|未能确认|无从确认|身份未明|不记得|记不起|并无印象|没有印象/u;
const ESTABLISHED_PAST_RELATION =
  /故人|旧识|多年未见|好久不见|当年.{0,12}(?:相识|并肩)|昔日.{0,12}(?:同门|好友|挚友)/u;

export function isStoryOmenIntroductionConsistent(input: {
  content: string;
  introductionMode: StoryEntityIntroductionMode;
  relationship: string;
}): boolean {
  if (input.introductionMode === 'established') return true;
  if (input.relationship !== 'unknown') return false;
  return (
    !ESTABLISHED_PAST_RELATION.test(input.content) ||
    UNVERIFIED_RELATION_MARKERS.test(input.content)
  );
}

const DEAD_ENTITY_ACTIVE_REPLY_PATTERN =
  /寄来(?:回)?信|又来信|回书|嘱咐|劝你|提醒你|要你注意安全|要你保重/u;
const PRE_RECORDED_MESSAGE_PATTERN = /生前|预先|遗留|绝笔|留音|早已封存/u;

export function isStoryAftermathNarrationConsistent(input: {
  content: string;
  entityName?: string;
  lifeStatus: StoryEntityLifeStatus;
  narratorMode: StoryAftermathNarratorMode;
}): boolean {
  if (input.lifeStatus !== 'dead') return true;
  if (input.narratorMode === 'entity_letter') return false;
  if (input.entityName) {
    const sentences = input.content.match(/[^。！？!?\n]+[。！？!?]?/gu) ?? [
      input.content,
    ];
    if (
      sentences.some(
        (sentence) =>
          sentence.includes(input.entityName!) &&
          DEAD_ENTITY_ACTIVE_REPLY_PATTERN.test(sentence) &&
          !/没有|未曾|不再|并无/u.test(sentence),
      )
    ) {
      return false;
    }
  }
  return (
    input.narratorMode !== 'pre_recorded_message' ||
    PRE_RECORDED_MESSAGE_PATTERN.test(input.content)
  );
}

const DEAD_ENTITY_HISTORICAL_MARKER =
  /已死|死去|死亡|陨落|被击败|遗留|生前|遗骸|尸身|旧事|当时/u;

export function isDeadStoryEntityMentionHistorical(
  content: string,
  entityName: string,
): boolean {
  const sentences = content.match(/[^。！？!?\n]+[。！？!?]?/gu) ?? [content];
  return sentences
    .filter((sentence) => sentence.includes(entityName))
    .every((sentence) => DEAD_ENTITY_HISTORICAL_MARKER.test(sentence));
}

const GENERIC_STORY_MEMORY_TAGS = new Set([
  '个人剧情',
  '前尘回响',
  '余波',
  '秘境',
  '完成',
  '撤离',
]);

export function storyMemoryRelevanceScore(
  trigger: { summary: string; tags: readonly string[] },
  candidate: { summary: string; tags: readonly string[] },
): number {
  const triggerTags = trigger.tags.filter(
    (tag) => !GENERIC_STORY_MEMORY_TAGS.has(tag),
  );
  const candidateTags = candidate.tags.filter(
    (tag) => !GENERIC_STORY_MEMORY_TAGS.has(tag),
  );
  const exactTagMatches = triggerTags.filter((tag) =>
    candidateTags.includes(tag),
  ).length;
  const crossTextMatches = new Set([
    ...triggerTags.filter((tag) => candidate.summary.includes(tag)),
    ...candidateTags.filter((tag) => trigger.summary.includes(tag)),
  ]).size;
  return exactTagMatches * 3 + crossTextMatches;
}

export function selectRelevantStoryMemories<
  T extends {
    summary: string;
    tags: readonly string[];
  },
>(trigger: T, candidates: readonly T[], limit = 3): T[] {
  return candidates
    .map((candidate, index) => ({
      candidate,
      index,
      score: storyMemoryRelevanceScore(trigger, candidate),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

const STORY_THRESHOLD_ONLY_PATTERN =
  /踏入|进入|推开.{0,8}门|打开.{0,8}入口|通往|门后|深入|即将|等待.{0,8}探索|尚未揭开|未见结果/u;
const STORY_RESOLUTION_EVIDENCE_PATTERN =
  /查明|确认|解决|平息|止息|终止|关闭|摧毁|击败|救出|封印已|目标已/u;

export function isStoryTerminalNarrativeResolved(narrative: string): boolean {
  return (
    !STORY_THRESHOLD_ONLY_PATTERN.test(narrative) ||
    STORY_RESOLUTION_EVIDENCE_PATTERN.test(narrative)
  );
}
