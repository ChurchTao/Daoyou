import { z } from 'zod';

// 云游探秘解谜模式：剧本模板、案卷、运行态与玩家投影。
// 案卷是服务端隐藏的真相，玩家只能拿到 MysteryPlayerView。

export const MysteryIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9_]+$/, 'id 只能包含小写字母、数字和下划线');

const Text = (max: number) => z.string().trim().min(1).max(max);

export type MysteryCondition =
  | { has_clue: string }
  | { has_item: string }
  | { flag: string }
  | { visited: string }
  | { all: MysteryCondition[] }
  | { any: MysteryCondition[] };

export const MysteryConditionSchema: z.ZodType<MysteryCondition> = z.lazy(() =>
  z.union([
    z.strictObject({ has_clue: MysteryIdSchema }),
    z.strictObject({ has_item: MysteryIdSchema }),
    z.strictObject({ flag: MysteryIdSchema }),
    z.strictObject({ visited: MysteryIdSchema }),
    z.strictObject({ all: z.array(MysteryConditionSchema).min(1).max(6) }),
    z.strictObject({ any: z.array(MysteryConditionSchema).min(1).max(6) }),
  ]),
);

export const MysteryEffectSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('reveal_clue'), clueId: MysteryIdSchema }),
  z.strictObject({ kind: z.literal('grant_item'), itemId: MysteryIdSchema }),
  z.strictObject({ kind: z.literal('consume_item'), itemId: MysteryIdSchema }),
  z.strictObject({ kind: z.literal('set_flag'), flag: MysteryIdSchema }),
]);

export type MysteryEffect = z.infer<typeof MysteryEffectSchema>;

export const MYSTERY_ARCHETYPE_VALUES = [
  'whodunit',
  'unlock',
  'retrieval',
  'allegiance',
] as const;

export const MYSTERY_ANSWER_KIND_VALUES = ['npc', 'clue', 'choice'] as const;

export type MysteryAnswerKind = (typeof MYSTERY_ANSWER_KIND_VALUES)[number];

const RangeSchema = z
  .tuple([z.number().int().min(0), z.number().int().min(0)])
  .refine(([min, max]) => min <= max, '范围下限不能大于上限');

export const MysteryScenarioTemplateSchema = z
  .strictObject({
    id: MysteryIdSchema,
    name: Text(24),
    archetype: z.enum(MYSTERY_ARCHETYPE_VALUES),
    summary: Text(400),
    fits_tags: z.array(Text(12)).max(20),
    scale: z.strictObject({
      rooms: RangeSchema,
      npcs: RangeSchema,
      key_clues: RangeSchema,
      red_herrings: RangeSchema,
      action_budget: z.number().int().min(6).max(60),
    }),
    roles: z
      .array(
        z.strictObject({
          slot: MysteryIdSchema,
          label: Text(12),
          count: RangeSchema,
          lies: z.boolean(),
          guidance: Text(200),
        }),
      )
      .min(1),
    questions: z
      .array(
        z.strictObject({
          id: MysteryIdSchema,
          prompt: Text(40),
          answer_kind: z.enum(MYSTERY_ANSWER_KIND_VALUES),
          guidance: Text(200),
        }),
      )
      .min(1)
      .max(5),
    branches: z
      .array(
        z.discriminatedUnion('kind', [
          z.strictObject({
            id: MysteryIdSchema,
            label: Text(24),
            kind: z.literal('expose_all_lies'),
            points: z.number().int().min(0).max(100),
          }),
          z.strictObject({
            id: MysteryIdSchema,
            label: Text(24),
            kind: z.literal('flag'),
            flag: MysteryIdSchema,
            guidance: Text(200),
            points: z.number().int().min(0).max(100),
          }),
        ]),
      )
      .max(4),
    scoring: z.strictObject({
      truth: z.number().int().min(0),
      coverage: z.number().int().min(0),
      efficiency: z.number().int().min(0),
      branch: z.number().int().min(0),
      combat: z.number().int().min(0),
    }),
    writing_guidance: Text(600),
  })
  .superRefine((template, ctx) => {
    const s = template.scoring;
    if (s.truth + s.coverage + s.efficiency + s.branch + s.combat !== 100) {
      ctx.addIssue({
        code: 'custom',
        path: ['scoring'],
        message: '评分权重之和必须为 100',
      });
    }
  });

export type MysteryScenarioTemplate = z.infer<
  typeof MysteryScenarioTemplateSchema
>;

const FoundAtSchema = z.strictObject({
  objectId: MysteryIdSchema,
  requires: MysteryConditionSchema.optional(),
});

export const MysteryCaseFileSchema = z.strictObject({
  templateId: MysteryIdSchema,
  title: Text(24),
  truth: Text(600),
  brief: z.strictObject({
    identity: Text(120),
    goal: Text(120),
    opening: Text(400),
    relations: z
      .array(z.strictObject({ npcId: MysteryIdSchema, text: Text(80) }))
      .max(6),
  }),
  startRoomId: MysteryIdSchema,
  rooms: z
    .array(
      z.strictObject({
        id: MysteryIdSchema,
        name: Text(16),
        description: Text(240),
        brief: Text(60),
        exits: z.array(MysteryIdSchema).max(6),
        requires: MysteryConditionSchema.optional(),
        lockedText: Text(80).optional(),
      }),
    )
    .min(2)
    .max(8),
  objects: z
    .array(
      z.strictObject({
        id: MysteryIdSchema,
        roomId: MysteryIdSchema,
        name: Text(16),
        detail: Text(220),
      }),
    )
    .min(1)
    .max(30),
  clues: z
    .array(
      z.strictObject({
        id: MysteryIdSchema,
        name: Text(16),
        text: Text(160),
        key: z.boolean(),
        supports: z.array(MysteryIdSchema).max(5),
        foundAt: FoundAtSchema.optional(),
      }),
    )
    .min(1)
    .max(16),
  items: z
    .array(
      z.strictObject({
        id: MysteryIdSchema,
        name: Text(16),
        text: Text(120),
        initial: z.boolean().optional(),
        foundAt: FoundAtSchema.optional(),
      }),
    )
    .max(8),
  npcs: z
    .array(
      z.strictObject({
        id: MysteryIdSchema,
        name: Text(12),
        title: Text(16),
        role: MysteryIdSchema,
        roomId: MysteryIdSchema,
        greeting: Text(200),
        idleLine: Text(120),
        deflectLine: Text(120),
        secrets: z
          .array(
            z.strictObject({
              clueId: MysteryIdSchema,
              requires: MysteryConditionSchema,
              line: Text(220),
            }),
          )
          .max(4),
        reactions: z
          .array(
            z.strictObject({
              id: MysteryIdSchema,
              evidenceId: MysteryIdSchema,
              line: Text(220),
              effects: z.array(MysteryEffectSchema).max(4),
              exposesLie: z.boolean(),
            }),
          )
          .max(4),
      }),
    )
    .min(1)
    .max(6),
  interactions: z
    .array(
      z.strictObject({
        id: MysteryIdSchema,
        itemId: MysteryIdSchema,
        targetId: MysteryIdSchema,
        requires: MysteryConditionSchema.optional(),
        text: Text(220),
        effects: z.array(MysteryEffectSchema).min(1).max(4),
      }),
    )
    .max(10),
  questions: z
    .array(
      z.strictObject({
        id: MysteryIdSchema,
        options: z
          .array(z.strictObject({ id: MysteryIdSchema, label: Text(30) }))
          .max(6)
          .optional(),
        answer: MysteryIdSchema,
        explanation: Text(200),
      }),
    )
    .min(1)
    .max(5),
});

export type MysteryCaseFile = z.infer<typeof MysteryCaseFileSchema>;

export type MysteryLogKind =
  'scene' | 'detail' | 'speech' | 'clue' | 'item' | 'system';

export interface MysteryLogEntry {
  turn: number;
  kind: MysteryLogKind;
  text: string;
  speaker?: string;
}

export interface MysteryRunState {
  turn: number;
  actionBudget: number;
  actionsLeft: number;
  location: string;
  visited: string[];
  searched: string[];
  clues: string[];
  items: string[];
  flags: string[];
  talkedTo: string[];
  firedReactions: string[];
  firedInteractions: string[];
  log: MysteryLogEntry[];
  lastActionId?: string;
  /** 与各人物的自由对话记录，每人只保留最近几轮。 */
  dialogue?: Record<string, Array<{ q: string; a: string }>>;
}

export const MysteryActionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('move'), roomId: MysteryIdSchema }),
  z.strictObject({ type: z.literal('search'), objectId: MysteryIdSchema }),
  z.strictObject({
    type: z.literal('use'),
    itemId: MysteryIdSchema,
    targetId: MysteryIdSchema,
  }),
  z.strictObject({ type: z.literal('talk'), npcId: MysteryIdSchema }),
  z.strictObject({
    type: z.literal('present'),
    npcId: MysteryIdSchema,
    evidenceId: MysteryIdSchema,
  }),
]);

export type MysteryAction = z.infer<typeof MysteryActionSchema>;

export const MysteryAnswersSchema = z.record(MysteryIdSchema, MysteryIdSchema);

export type MysteryAnswers = z.infer<typeof MysteryAnswersSchema>;

export type MysteryRewardTier = 'S' | 'A' | 'B' | 'C' | 'D';

export interface MysteryScoreBreakdown {
  truth: number;
  coverage: number;
  efficiency: number;
  branch: number;
  combat: number;
}

export interface MysteryResult {
  answers: MysteryAnswers;
  correct: Record<string, boolean>;
  breakdown: MysteryScoreBreakdown;
  maxBreakdown: MysteryScoreBreakdown;
  total: number;
  tier: MysteryRewardTier;
  branches: string[];
  keyCluesFound: number;
  keyCluesTotal: number;
}

/** 服务端权威记录，挂在 DungeonState.mystery 上，绝不直接下发。 */
export interface MysteryRecord {
  templateId: string;
  /** library：取自剧本库；generated：冷启动实时生成；fallback：手写保底。 */
  caseSource: 'library' | 'generated' | 'fallback';
  caseFile: MysteryCaseFile;
  run: MysteryRunState;
  result?: MysteryResult;
  /** 对应剧本库中的剧本；保底案卷未入库时为空。 */
  scenarioId?: string;
  /** 冷启动生成的案卷需要在开局提交时一并入库。 */
  insertScenario?: boolean;
  /** 已结案过的本再玩一次：仅用于提示与统计，结算与首次相同。 */
  replay?: boolean;
  /** 首次进入此本：用于累计剧本的全服游玩人数。 */
  firstPlay?: boolean;
  /** 开局提交后需要为该槽投递的补货请求。 */
  restock?: { reason: 'exhausted' | 'low_stock' | 'cold_start' };
  /** 结算统计已写入剧本库，防止重试时重复累计。 */
  statsRecorded?: boolean;
}

export interface MysteryPlayerView {
  title: string;
  /** 此案已经历过（结案过）。 */
  replay: boolean;
  templateName: string;
  brief: MysteryCaseFile['brief'] & {
    relations: Array<{ npcId: string; name: string; text: string }>;
  };
  turn: number;
  actionBudget: number;
  actionsLeft: number;
  location: { id: string; name: string; description: string };
  exits: Array<{ id: string; name: string; locked: boolean; hint?: string }>;
  objects: Array<{ id: string; name: string; searched: boolean }>;
  npcsHere: Array<{ id: string; name: string; title: string }>;
  knownNpcs: Array<{ id: string; name: string; title: string }>;
  clues: Array<{ id: string; name: string; text: string }>;
  items: Array<{ id: string; name: string; text: string }>;
  log: MysteryLogEntry[];
  questions: Array<{
    id: string;
    prompt: string;
    kind: MysteryAnswerKind;
    options?: Array<{ id: string; label: string }>;
  }>;
  result?: MysteryResult & {
    truth: string;
    explanations: Array<{
      questionId: string;
      prompt: string;
      answerLabel: string;
      explanation: string;
    }>;
  };
}
