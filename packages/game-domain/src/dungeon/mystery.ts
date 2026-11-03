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

/** 随回合发生的事件可能造成的后果：物件被毁、人物离场或设置标记。 */
export const MysteryEventEffectSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('destroy_object'),
    objectId: MysteryIdSchema,
  }),
  z.strictObject({ kind: z.literal('npc_leave'), npcId: MysteryIdSchema }),
  z.strictObject({ kind: z.literal('set_flag'), flag: MysteryIdSchema }),
  z.strictObject({
    kind: z.literal('lock_mechanism'),
    mechanismId: MysteryIdSchema,
  }),
  z.strictObject({ kind: z.literal('seal_room'), roomId: MysteryIdSchema }),
]);

export type MysteryEventEffect = z.infer<typeof MysteryEventEffectSchema>;

export const MYSTERY_ARCHETYPE_VALUES = [
  'whodunit',
  'unlock',
  'retrieval',
  'allegiance',
  'anomaly',
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
          /** 抉择题：没有标准答案，不计入真相分，只决定结局走向。 */
          judgement: z.boolean().optional(),
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
    /**
     * 结尾对决：`when` 中的问题全部答对时，身份为 `role` 的人物翻脸动手，
     * 战胜得 `points` 分；战斗分的其余部分按通过守卫的比例计。
     */
    finale: z
      .strictObject({
        role: MysteryIdSchema,
        when: z.array(MysteryIdSchema).min(1).max(5),
        points: z.number().int().min(0),
      })
      .optional(),
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
    const finale = template.finale;
    if (finale && finale.points > s.combat) {
      ctx.addIssue({
        code: 'custom',
        path: ['finale', 'points'],
        message: '结尾对决分不能超过战斗权重',
      });
    }
    if (
      finale &&
      finale.when.some((id) => !template.questions.some((q) => q.id === id))
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['finale', 'when'],
        message: '结尾对决引用了不存在的结案问题',
      });
    }
  });

export type MysteryScenarioTemplate = z.infer<
  typeof MysteryScenarioTemplateSchema
>;

/** 机关的提示规则：某部件居第几位、某部件在另一部件之前、某部件不在其中。 */
export const MysteryHintRuleSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('position'),
    part: MysteryIdSchema,
    index: z.number().int().min(0).max(2),
  }),
  z.strictObject({
    kind: z.literal('before'),
    first: MysteryIdSchema,
    then: MysteryIdSchema,
  }),
  z.strictObject({ kind: z.literal('absent'), part: MysteryIdSchema }),
]);

export type MysteryHintRule = z.infer<typeof MysteryHintRuleSchema>;

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
    .max(20),
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
  /**
   * 随回合推进的事件：到 `warnAt` 回合给出预兆，到 `at` 回合发生；
   * 发生前 `unless` 已满足则不再发生。旧案卷没有此字段。
   */
  events: z
    .array(
      z.strictObject({
        id: MysteryIdSchema,
        warnAt: z.number().int().min(1),
        at: z.number().int().min(1),
        unless: MysteryConditionSchema,
        warning: Text(160),
        text: Text(200),
        effects: z.array(MysteryEventEffectSchema).min(1).max(3),
      }),
    )
    .max(3)
    .optional(),
  /**
   * 机关：按次序从 4 个部件中选 3 个开启。`final` 为主禁制，只在结案时作答、不可操作。
   * 提示规则挂在提示线索上，线索正文由程序按规则渲染。旧案卷没有此字段。
   */
  mechanisms: z
    .array(
      z.strictObject({
        id: MysteryIdSchema,
        objectId: MysteryIdSchema,
        name: Text(12),
        final: z.boolean(),
        parts: z
          .array(z.strictObject({ id: MysteryIdSchema, label: Text(8) }))
          .length(4),
        solution: z.array(MysteryIdSchema).length(3),
        hints: z
          .array(
            z.strictObject({
              clueId: MysteryIdSchema,
              rule: MysteryHintRuleSchema,
            }),
          )
          .min(1)
          .max(4),
        onSolve: z.array(MysteryEffectSchema).max(3),
        solvedText: Text(200),
        backlashText: Text(160),
      }),
    )
    .max(3)
    .optional(),
  /** 异变化形：异变溯源中结尾对决的对手，不是人物。 */
  manifest: z
    .strictObject({ name: Text(12), description: Text(200) })
    .optional(),
  /** 守住某个房间入口的守卫：可强闯（战斗）或满足条件后化解。旧案卷没有此字段。 */
  guards: z
    .array(
      z.strictObject({
        id: MysteryIdSchema,
        roomId: MysteryIdSchema,
        name: Text(12),
        description: Text(200),
        bypass: MysteryConditionSchema,
        bypassText: Text(200),
      }),
    )
    .max(2)
    .optional(),
});

export type MysteryCaseFile = z.infer<typeof MysteryCaseFileSchema>;

export type MysteryLogKind =
  | 'scene'
  | 'detail'
  | 'speech'
  | 'clue'
  | 'item'
  | 'system'
  | 'event'
  | 'hint';

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
  /** 已通过（化解或击败）的守卫。 */
  passedGuards?: string[];
  /** 已给出预兆（`warn:` 前缀）或已发生的事件。 */
  events?: string[];
  /** 被毁去、不能再搜查的物件。 */
  destroyed?: string[];
  /** 已离场的人物。 */
  departed?: string[];
  /** 被异变封住、不能再进入的房间。 */
  sealedRooms?: string[];
  /** 各机关的操作结果：失败次数与是否开启、是否锁死。 */
  mechanisms?: Record<
    string,
    { failures: number; solved: boolean; locked: boolean }
  >;
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
  z.strictObject({ type: z.literal('bypass_guard'), guardId: MysteryIdSchema }),
  z.strictObject({ type: z.literal('reflect') }),
  z.strictObject({
    type: z.literal('operate'),
    mechanismId: MysteryIdSchema,
    sequence: z.array(MysteryIdSchema).length(3),
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

/**
 * 指认真凶后的对决结果：won 擒下、lost 落败让其逃脱、spared 未迎战任其遁走、
 * none 未指认真凶（不触发对决）。
 */
export type MysteryConfrontationOutcome = 'won' | 'lost' | 'spared' | 'none';

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
  /** 模板含战斗权重时记录对决结果。 */
  confrontation?: MysteryConfrontationOutcome;
  /** 案卷有守卫时记录通过情况。 */
  guards?: { passed: number; total: number };
}

/** 服务端权威记录，挂在 DungeonState.mystery 上，绝不直接下发。 */
export interface MysteryRecord {
  templateId: string;
  /** library：取自剧本库；generated：冷启动实时生成；fallback：手写保底。 */
  caseSource: 'library' | 'generated' | 'fallback';
  caseFile: MysteryCaseFile;
  run: MysteryRunState;
  result?: MysteryResult;
  /** 已指认真凶、等待对决结果的结案答案；对决结束后连同结果一起评分。 */
  verdict?: { answers: MysteryAnswers; culpritId: string };
  /** 正在强闯的守卫：遭遇战结束后回到调查。 */
  pendingGuard?: string;
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

/** 线索或物品从哪里得来：某个地点或某个人。 */
export interface MysterySourceRef {
  kind: 'place' | 'person';
  id: string;
  name: string;
}

/** 玩家眼中人物的状态：尚未交谈、交谈过、出示证据后交底、谎言被戳穿、已离场。 */
export type MysteryNpcStatus =
  | 'unmet'
  | 'talked'
  | 'opened'
  | 'exposed'
  | 'departed';

/** 已知地点：到访过的房间及其相邻房间。 */
export interface MysteryMapRoom {
  id: string;
  name: string;
  /** 距入口的步数，供示意图分层。 */
  depth: number;
  here: boolean;
  visited: boolean;
  locked: boolean;
  guarded: boolean;
  /** 在场人物数，仅到访过的房间。 */
  people: number;
  /** 此处有物件被毁。 */
  disturbed: boolean;
  /** 被异变封住。 */
  sealed: boolean;
  /** 物件看过几件、共几件，仅到访过的房间。 */
  searched: number;
  objects: number;
}

export interface MysteryPlayerView {
  title: string;
  /** 此案已经历过（结案过）。 */
  replay: boolean;
  /** 结案答对后对手会翻脸动手，战胜才能拿到对决分。 */
  confrontation: boolean;
  /** 正在等待的遭遇战：结尾对决或强闯守卫。 */
  pendingBattle?: 'finale' | 'guard';
  templateName: string;
  brief: MysteryCaseFile['brief'] & {
    relations: Array<{ npcId: string; name: string; text: string }>;
  };
  turn: number;
  actionBudget: number;
  actionsLeft: number;
  location: { id: string; name: string; description: string };
  exits: Array<{
    id: string;
    name: string;
    locked: boolean;
    hint?: string;
    guard?: {
      id: string;
      name: string;
      description: string;
      canBypass: boolean;
    };
  }>;
  objects: Array<{
    id: string;
    name: string;
    searched: boolean;
    /** 物件上的机关（主禁制不在此列）。 */
    mechanism?: {
      id: string;
      name: string;
      parts: Array<{ id: string; label: string }>;
      failures: number;
      maxFailures: number;
      solved: boolean;
      locked: boolean;
    };
  }>;
  npcsHere: Array<{ id: string; name: string; title: string }>;
  knownNpcs: Array<{
    id: string;
    name: string;
    title: string;
    status: MysteryNpcStatus;
    /** 所在地点；离场或尚未到过其所在房间时为空。 */
    roomId?: string;
    roomName?: string;
    lastLine?: string;
  }>;
  clues: Array<{
    id: string;
    name: string;
    text: string;
    source?: MysterySourceRef;
  }>;
  items: Array<{
    id: string;
    name: string;
    text: string;
    source?: MysterySourceRef;
  }>;
  /** 已出现预兆、尚未发生也未被阻止的事件。 */
  alerts: Array<{ id: string; text: string }>;
  map: { rooms: MysteryMapRoom[]; edges: Array<[string, string]> };
  log: MysteryLogEntry[];
  questions: Array<{
    id: string;
    prompt: string;
    kind: MysteryAnswerKind;
    options?: Array<{ id: string; label: string }>;
    /** 抉择题，没有对错。 */
    judgement?: boolean;
  }>;
  result?: MysteryResult & {
    truth: string;
    explanations: Array<{
      questionId: string;
      prompt: string;
      answerLabel: string;
      explanation: string;
      /** 抉择题：answerLabel 是玩家的选择，不是标准答案。 */
      judgement?: boolean;
    }>;
  };
}
