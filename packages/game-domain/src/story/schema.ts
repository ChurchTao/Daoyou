import {
  REALM_ORDER,
  REALM_STAGE_VALUES,
  REALM_VALUES,
  type RealmStage,
  type RealmType,
} from '@daoyou/constants/realms';
import { z } from 'zod';

export const MINE_LESSON_METHOD_LEVEL = 10;

export const STORY_FACT_IDS = [
  'starter_beast',
  'alchemy_crafted',
  'foundation_pill_crafted',
  'spring_recovered',
  'condition_restored',
  'dungeon_settled',
  'qingxi_sought',
  'qingxi_met',
  'weapon_forged',
  'weapon_equipped',
  'story_weapon_equipped',
  'sect_joined',
  'sect_ready',
  'sect_methods_at_lesson_level',
  'breakthrough_available',
  'consumable_used',
  'market_bought',
  'sect_trained',
] as const;

export type StoryFactId = (typeof STORY_FACT_IDS)[number];

export const STORY_MARK_FACT_IDS = [
  'alchemy_crafted',
  'foundation_pill_crafted',
  'spring_recovered',
  'dungeon_settled',
  'qingxi_sought',
  'qingxi_met',
  'weapon_forged',
  // 用过一次随身的丹药等消耗品。
  'consumable_used',
  // 在坊市买过一样东西。
  'market_bought',
  // 修习过一次心法，或打通过一处经脉。
  'sect_trained',
] as const satisfies readonly StoryFactId[];

export const STORY_TRACKS = ['main', 'encounter'] as const;

export type StoryTrack = (typeof STORY_TRACKS)[number];

export const STORY_STATUSES = ['active', 'completed'] as const;

const progressMarkIds = ['arrival-v2'] as const;
const STORY_WEAPON_PREFIX = 'weapon:';
const storyWeaponIdSchema = z.uuid();

export type StoryStatus = (typeof STORY_STATUSES)[number];

const factSchema = z.enum(STORY_FACT_IDS);

// 走到这一幕就开放的场景入口，写场景编号。
const unlocksSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(12)
  .optional();

// 这一幕演完、做完、打完时给玩家的一份东西，写赠礼编号。
const giftSchema = z.string().trim().min(1).max(40).optional();

const mapKey = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[A-Za-z0-9_-]+$/);
const storyLocationSchema = z.discriminatedUnion('kind', [
  z
    .object({ kind: z.literal('area'), areaId: mapKey, placeId: mapKey })
    .strict(),
  z.object({ kind: z.literal('sect'), spotId: mapKey }).strict(),
  z.object({ kind: z.literal('cave') }).strict(),
]);
const locationEntrySchema = z
  .object({
    kind: z.enum(['npc', 'facility']),
    id: mapKey,
  })
  .strict();
const passageActionSchema = z
  .object({
    id: mapKey,
    hint: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

// 从上一幕接续时的呈现方式。暂停或从地图回来仍走当前幕的现场入口。
const storyArrival = z.enum(['activity', 'location', 'map']).optional();

const taskIndicatorFields = {
  location: storyLocationSchema.optional(),
  entry: locationEntrySchema.optional(),
  actionLabel: z.string().trim().min(1).max(24).optional(),
  indicatorFrom: z
    .array(
      z
        .string()
        .trim()
        .max(120)
        .regex(/^\/game(?:[/?]|$)/),
    )
    .min(1)
    .max(4)
    .optional(),
};
const taskActionSchema = z
  .object({
    label: z.string().trim().min(1).max(24),
    href: z.string().trim().min(1).max(120),
  })
  .strict();

// 招呼：洞府里，这一幕等着玩家的那个人说的一句话。名字里可以带演出的占位符。
const hailSchema = z
  .object({
    by: z.string().trim().min(1).max(20),
    portrait: z.string().trim().min(1).max(60).optional(),
    line: z.string().trim().min(1).max(80),
  })
  .strict()
  .optional();

const performanceBeatSchema = z
  .object({
    id: z.string().trim().min(1).max(40),
    kind: z.literal('performance'),
    script: z.string().trim().min(1).max(80),
    outcome: z.string().trim().min(1).max(40),
    // 可在这一幕选择重打上一幕实际落败的一场。
    retryLostBattle: z.literal(true).optional(),
    requireBattleVictory: z.literal(true).optional(),
    // 从主线入口续读时先播放，也可稍后从现场入口接续。
    playOnResume: z.literal(true).optional(),
    arrival: storyArrival,
    finishLabel: z.string().trim().min(1).max(24).optional(),
    // 演出结束后先回到指定场景，由玩家在那里接续下一幕。
    exitHref: z
      .string()
      .trim()
      .max(120)
      .regex(/^\/game(?:[/?]|$)/)
      .optional(),
    scene: z.string().trim().min(1).max(40),
    prompt: z.string().max(80),
    href: z.string().trim().min(1).max(120),
    ...taskIndicatorFields,
    unlocks: unlocksSchema,
    hail: hailSchema,
    gift: giftSchema,
  })
  .strict();

const lessonIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const flagSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9]+(?:[-.:][a-z0-9]+)*$/);

// 只增不减的累计数。进了一幕先记下当时的数，往后只算新做的。
export const STORY_COUNT_IDS = ['sect_dailies', 'retreats'] as const;

export type StoryCountId = (typeof STORY_COUNT_IDS)[number];

// 等待幕与目标幕的门槛：做到了，故事才往下走。
export const StoryConditionSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('count'),
      count: z.enum(STORY_COUNT_IDS),
      atLeast: z.number().int().min(1).max(99),
    })
    .strict(),
  z.object({ type: z.literal('fact'), fact: factSchema }).strict(),
  z.object({ type: z.literal('flag'), flag: flagSchema }).strict(),
  z
    .object({
      type: z.literal('realm'),
      realm: z.enum(REALM_VALUES),
      stage: z.enum(REALM_STAGE_VALUES).optional(),
    })
    .strict(),
]);

export type StoryCondition = z.infer<typeof StoryConditionSchema>;

const acceptanceSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('fact'),
      fact: factSchema,
      progressLabel: z.string().trim().min(1).max(40).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('guide'),
      lesson: lessonIdSchema,
    })
    .strict(),
]);

const practiceBeatSchema = z
  .object({
    id: z.string().trim().min(1).max(40),
    kind: z.literal('practice'),
    arrival: storyArrival,
    accept: z.array(acceptanceSchema).min(1).max(4),
    mode: z.enum(['any', 'all']).optional(),
    scene: z.string().trim().min(1).max(40),
    prompt: z.string().trim().min(1).max(80),
    href: z.string().trim().min(1).max(120),
    ...taskIndicatorFields,
    missingItemAction: taskActionSchema.optional(),
    unlocks: unlocksSchema,
    hail: hailSchema,
    gift: giftSchema,
    lesson: lessonIdSchema.optional(),
    grant: z.string().trim().min(1).max(40).optional(),
    reward: z.string().trim().min(1).max(40).optional(),
  })
  .strict();

const lifeBeatSchema = z
  .object({
    id: z.string().trim().min(1).max(40),
    kind: z.literal('life'),
    scene: z.string().trim().min(1).max(40),
    prompt: z.string().max(80),
    href: z.string().trim().min(1).max(120),
    ...taskIndicatorFields,
    unlocks: unlocksSchema,
    hail: hailSchema,
    gift: giftSchema,
    when: z
      .object({
        fact: factSchema,
        prompt: z.string().trim().min(1).max(80),
        href: z.string().trim().min(1).max(120),
        ...taskIndicatorFields,
      })
      .strict()
      .optional(),
  })
  .strict();

// 等待：门槛没到之前停在这里，界面上写明还差什么。
const waitBeatSchema = z
  .object({
    id: z.string().trim().min(1).max(40),
    kind: z.literal('wait'),
    until: StoryConditionSchema,
    scene: z.string().trim().min(1).max(40),
    prompt: z.string().trim().min(1).max(80),
    href: z.string().trim().min(1).max(120),
    ...taskIndicatorFields,
    unlocks: unlocksSchema,
    hail: hailSchema,
    gift: giftSchema,
  })
  .strict();

// 目标：几件事都做到才往下走，不分先后，界面逐条显示。
const objectiveBeatSchema = z
  .object({
    id: z.string().trim().min(1).max(40),
    kind: z.literal('objective'),
    goals: z
      .array(
        z
          .object({
            label: z.string().trim().min(1).max(40),
            need: StoryConditionSchema,
          })
          .strict(),
      )
      .min(1)
      .max(4),
    scene: z.string().trim().min(1).max(40),
    prompt: z.string().trim().min(1).max(80),
    href: z.string().trim().min(1).max(120),
    ...taskIndicatorFields,
    unlocks: unlocksSchema,
    hail: hailSchema,
    gift: giftSchema,
    grant: z.string().trim().min(1).max(40).optional(),
    reward: z.string().trim().min(1).max(40).optional(),
  })
  .strict();

// 剧情战：对手和胜负规则由主线指定，打完才往下走。
const battleBeatSchema = z
  .object({
    id: z.string().trim().min(1).max(40),
    kind: z.literal('battle'),
    arrival: storyArrival,
    battle: z.string().trim().min(1).max(40),
    // 头一回打架时带的那场教学。看不看都不耽误往下走。
    lesson: lessonIdSchema.optional(),
    scene: z.string().trim().min(1).max(40),
    prompt: z.string().trim().min(1).max(80),
    href: z.string().trim().min(1).max(120),
    ...taskIndicatorFields,
    unlocks: unlocksSchema,
    hail: hailSchema,
    gift: giftSchema,
  })
  .strict();

const passageBeatSchema = z
  .object({
    id: mapKey,
    kind: z.literal('passage'),
    arrival: storyArrival,
    scene: z.string().trim().min(1).max(40),
    prompt: z.string().trim().min(1).max(80),
    ...taskIndicatorFields,
    location: storyLocationSchema,
    passage: passageActionSchema,
    unlocks: unlocksSchema,
    hail: hailSchema,
    gift: giftSchema,
  })
  .strict();

export const StoryBeatSchema = z.discriminatedUnion('kind', [
  performanceBeatSchema,
  battleBeatSchema,
  practiceBeatSchema,
  objectiveBeatSchema,
  waitBeatSchema,
  lifeBeatSchema,
  passageBeatSchema,
]);

export function createStoryChapterSchema({
  getGuideLesson,
  hasStoryReward,
  hasStoryBattle,
}: {
  getGuideLesson: (id: string) => unknown;
  hasStoryReward: (id: string) => boolean;
  hasStoryBattle: (id: string) => boolean;
}) {
  const StoryChapterSchema = z
    .object({
      id: z.string().trim().min(1).max(80),
      track: z.enum(STORY_TRACKS),
      title: z.string().trim().min(1).max(40),
      completionGift: giftSchema,
      // 这一章演完之后接哪一章。不写就停在最后一幕。
      next: z.string().trim().min(1).max(80).optional(),
      // 这一章期间只显示已开放的入口。
      gated: z.boolean().optional(),
      // 结束集中引导后，仅这些入口还需要逐个开放。
      deferredUnlocks: unlocksSchema,
      beats: z.array(StoryBeatSchema).min(1).max(40),
    })
    .strict()
    .superRefine((chapter, context) => {
      const ids = new Set<string>();
      const payouts = new Set<string>();
      if (chapter.completionGift) {
        if (!chapter.next || !hasStoryReward(chapter.completionGift)) {
          context.addIssue({
            code: 'custom',
            message: `章末赠礼无效：${chapter.completionGift}`,
          });
        }
        payouts.add(chapter.completionGift);
      }
      if (!chapter.next && chapter.beats.at(-1)?.kind !== 'life') {
        context.addIssue({
          code: 'custom',
          message: '没有下一章的章节要停在常驻幕上',
        });
      }
      for (const [index, beat] of chapter.beats.entries()) {
        if (ids.has(beat.id)) {
          context.addIssue({
            code: 'custom',
            message: `剧情幕重复：${beat.id}`,
          });
        }
        ids.add(beat.id);
        if (beat.kind === 'battle' && !hasStoryBattle(beat.battle)) {
          context.addIssue({
            code: 'custom',
            message: `没有这场剧情战：${beat.battle}`,
          });
        }
        if (
          beat.kind === 'performance' &&
          (beat.retryLostBattle || beat.requireBattleVictory) &&
          chapter.beats[index - 1]?.kind !== 'battle'
        ) {
          context.addIssue({
            code: 'custom',
            message: `核对战果的演出前须是剧情战：${beat.id}`,
          });
        }
        if (beat.gift) {
          if (!hasStoryReward(beat.gift) || payouts.has(beat.gift)) {
            context.addIssue({
              code: 'custom',
              message: `赠礼不存在或重复：${beat.gift}`,
            });
          }
          payouts.add(beat.gift);
        }
        if (beat.kind === 'objective') {
          for (const payout of [beat.grant, beat.reward]) {
            if (!payout) continue;
            if (!hasStoryReward(payout) || payouts.has(payout)) {
              context.addIssue({
                code: 'custom',
                message: `奖励不存在或重复：${payout}`,
              });
            }
            payouts.add(payout);
          }
        }
        if (beat.kind !== 'practice') continue;
        const guides = [
          ...beat.accept.filter((entry) => entry.type === 'guide'),
          ...(beat.lesson ? [{ lesson: beat.lesson }] : []),
        ];
        if (new Set(guides.map((entry) => entry.lesson)).size > 1) {
          context.addIssue({
            code: 'custom',
            message: `一幕只带一场教学：${beat.id}`,
          });
        }
        for (const guide of guides) {
          if (!getGuideLesson(guide.lesson)) {
            context.addIssue({
              code: 'custom',
              message: `教学不存在：${guide.lesson}`,
            });
          }
          const href = new URL(beat.href, 'http://story.local');
          if (href.searchParams.get('guide') !== guide.lesson) {
            context.addIssue({
              code: 'custom',
              message: `这一幕的去处没有带上这场教学：${beat.id}`,
            });
          }
        }
        if (beat.grant && beat.reward && beat.grant === beat.reward) {
          context.addIssue({
            code: 'custom',
            message: `开幕和完成要用两份奖励：${beat.id}`,
          });
        }
        for (const payout of [beat.grant, beat.reward]) {
          if (!payout) continue;
          if (!hasStoryReward(payout)) {
            context.addIssue({
              code: 'custom',
              message: `没有这份奖励：${payout}`,
            });
          }
          if (payouts.has(payout)) {
            context.addIssue({
              code: 'custom',
              message: `奖励编号重复：${payout}`,
            });
          }
          payouts.add(payout);
        }
      }
    });
  return { StoryChapterSchema };
}

export const StoryProgressSchema = z
  .object({
    track: z.enum(STORY_TRACKS),
    storyId: z.string().trim().min(1).max(80),
    beatId: z.string().trim().min(1).max(80),
    status: z.enum(STORY_STATUSES),
    acks: z.array(z.string().trim().min(1).max(120)),
    grants: z.array(z.string().trim().min(1).max(40)),
    marks: z.array(
      z
        .string()
        .trim()
        .min(1)
        .max(80)
        .refine(
          (value) =>
            (STORY_MARK_FACT_IDS as readonly string[]).includes(value) ||
            (progressMarkIds as readonly string[]).includes(value) ||
            /^flag:[a-z0-9]+(?:[-.:][a-z0-9]+)*$/.test(value) ||
            /^battle:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ||
            /^base:[a-z0-9-]+:[a-z_]+=\d+$/.test(value) ||
            /^guide:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ||
            (value.startsWith(STORY_WEAPON_PREFIX) &&
              storyWeaponIdSchema.safeParse(
                value.slice(STORY_WEAPON_PREFIX.length),
              ).success),
          '剧情标记无法识别',
        ),
    ),
  })
  .strict();

export const StoryViewSchema = z
  .object({
    track: z.enum(STORY_TRACKS),
    chapterId: z.string(),
    chapterTitle: z.string(),
    beatId: z.string(),
    kind: z.enum([
      'performance',
      'battle',
      'practice',
      'objective',
      'wait',
      'life',
      'passage',
    ]),
    scene: z.string(),
    prompt: z.string(),
    href: z.string(),
    ...taskIndicatorFields,
    playHref: z.string().optional(),
    arrival: storyArrival,
    resumeHref: z.string().optional(),
    finishLabel: z.string().optional(),
    passage: passageActionSchema.optional(),
    exitHref: z.string().optional(),
    scriptId: z.string().nullable(),
    // 眼下是剧情战的话，是哪一场。
    battleId: z.string().nullable(),
    guideLesson: z.string().nullable(),
    targetItem: z
      .object({
        id: z.uuid(),
        missingAction: taskActionSchema.optional(),
      })
      .strict()
      .optional(),
    // 这一幕等着玩家的人和他的一句话。没写就为空。
    hail: z
      .object({
        by: z.string(),
        portrait: z.string().nullable(),
        line: z.string(),
      })
      .strict()
      .nullable(),
    // 眼下开放的场景入口。为空表示不设限。
    unlocked: z.array(z.string()).nullable(),
    // 眼下这一幕刚开放的入口，界面上标成新的。
    fresh: z.array(z.string()),
    // 演出里选下并记住的标记，跨章节都认。
    flags: z.array(z.string()),
    // 当前幕展示给任务指示器的目标。
    goals: z.array(
      z
        .object({
          label: z.string(),
          done: z.boolean(),
          // 计数目标的进度；不是计数就为空。
          current: z.number().int().nullable(),
          target: z.number().int().nullable(),
        })
        .strict(),
    ),
  })
  .strict();

export type StoryBeat = z.infer<typeof StoryBeatSchema>;

export type StoryChapter = z.infer<
  ReturnType<typeof createStoryChapterSchema>['StoryChapterSchema']
>;

export type StoryProgress = z.infer<typeof StoryProgressSchema>;

export type StoryView = z.infer<typeof StoryViewSchema>;

export interface StoryStanding {
  realm: RealmType;
  stage: RealmStage;
}

export type StoryFacts = Record<StoryFactId, boolean> & {
  equippedWeaponId?: string;
  /** 眼下的境界。没给就当门槛没到。 */
  standing?: StoryStanding;
  /** 各项累计数眼下的值。 */
  counts?: Partial<Record<StoryCountId, number>>;
  /** 带进度的事实由业务状态提供当前值和目标值。 */
  factProgress?: Partial<
    Record<StoryFactId, { current: number; target: number }>
  >;
};

/** 一章里走到某一幕为止，沿途开放过的入口。不给幕就算整章。 */
export function chapterUnlocks(chapter: StoryChapter, uptoBeatId?: string) {
  const end = uptoBeatId
    ? chapter.beats.findIndex((beat) => beat.id === uptoBeatId)
    : chapter.beats.length - 1;
  return chapter.beats.slice(0, end + 1).flatMap((beat) => beat.unlocks ?? []);
}

export function baseMark(beatId: string, count: StoryCountId, value: number) {
  return `base:${beatId}:${count}=${value}`;
}

/** 进这一幕时记下的累计数。没记过就是空。 */
export function readBaseMark(
  marks: readonly string[],
  beatId: string,
  count: StoryCountId,
): number | null {
  const prefix = `base:${beatId}:${count}=`;
  const mark = marks.find((entry) => entry.startsWith(prefix));
  return mark ? Number(mark.slice(prefix.length)) : null;
}

const FLAG_MARK = 'flag:';

export function storyWeaponMark(weaponId: string) {
  return STORY_WEAPON_PREFIX + storyWeaponIdSchema.parse(weaponId);
}

export function readStoryWeaponId(marks: readonly string[]) {
  return marks
    .find((mark) => mark.startsWith(STORY_WEAPON_PREFIX))
    ?.slice(STORY_WEAPON_PREFIX.length);
}

export function flagMark(flag: string): string {
  return `${FLAG_MARK}${flag}`;
}

/** 从进度标记里取出演出记下的标记。 */
export function storyFlags(marks: readonly string[]): string[] {
  return marks
    .filter((mark) => mark.startsWith(FLAG_MARK))
    .map((mark) => mark.slice(FLAG_MARK.length));
}

export function standingReaches(
  standing: StoryStanding | undefined,
  realm: RealmType,
  stage: RealmStage = REALM_STAGE_VALUES[0],
): boolean {
  if (!standing) return false;
  const gap = REALM_ORDER[standing.realm] - REALM_ORDER[realm];
  if (gap !== 0) return gap > 0;
  return (
    REALM_STAGE_VALUES.indexOf(standing.stage) >=
    REALM_STAGE_VALUES.indexOf(stage)
  );
}

export function emptyStoryFacts(): StoryFacts {
  return {
    starter_beast: false,
    alchemy_crafted: false,
    foundation_pill_crafted: false,
    spring_recovered: false,
    condition_restored: false,
    dungeon_settled: false,
    qingxi_sought: false,
    qingxi_met: false,
    weapon_forged: false,
    weapon_equipped: false,
    story_weapon_equipped: false,
    sect_joined: false,
    sect_ready: false,
    sect_methods_at_lesson_level: false,
    breakthrough_available: false,
    consumable_used: false,
    market_bought: false,
    sect_trained: false,
  };
}

export const STORY_BATTLE_OUTCOMES = ['won', 'lost', 'rescued'] as const;

export type StoryBattleOutcome = (typeof STORY_BATTLE_OUTCOMES)[number];

/** 一场剧情战：对手是谁、多强，输了怎么办，要不要有人出手收场。 */
export const StoryBattleSchema = z
  .object({
    id: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(40),
    title: z.string().trim().min(1).max(20),
    opponents: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(12),
            icon: z.string().trim().min(1).max(60).optional(),
            level: z.number().int().min(1).max(180),
            kind: z.enum(['normal', 'elite', 'boss']),
            // 在同级预设敌人的基础上乘多少。
            hp: z.number().min(0.05).max(5),
            attack: z.number().min(0.05).max(5),
            speed: z.number().min(0.05).max(5).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(3),
    // 输了怎么办：pass 照样往下演，retry 要再打一次。
    defeat: z.enum(['pass', 'retry']),
    // 打满这么多回合还没分出胜负，就有人出手收场，算过关。
    rescueAfter: z.number().int().min(1).max(20).optional(),
    // 不管玩家眼下带着多少伤，都按满气血满法力上场。
    fresh: z.boolean(),
    // 剧情里伙伴不在场时，只投影角色本人。
    solo: z.boolean().optional(),
  })
  .strict();

export type StoryBattle = z.infer<typeof StoryBattleSchema>;

/** 剧情战打出的结果记成标记，后面的演出可以据此分支。 */
export function battleFlag(battleId: string, outcome: StoryBattleOutcome) {
  return `battle.${battleId}.${outcome}`;
}

export function battleMark(battleId: string) {
  return `battle:${battleId}`;
}
