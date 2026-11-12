import {
  REALM_ORDER,
  REALM_STAGE_VALUES,
  REALM_VALUES,
  type RealmStage,
  type RealmType,
} from '@daoyou/constants/realms';
import { z } from 'zod';

export const STORY_FACT_IDS = [
  'starter_beast',
  'alchemy_crafted',
  'dungeon_settled',
  'qingxi_sought',
  'qingxi_met',
  'weapon_forged',
  'weapon_equipped',
  'sect_joined',
  'sect_ready',
  'breakthrough_available',
  'consumable_used',
  'market_bought',
  'sect_trained',
] as const;

export type StoryFactId = (typeof STORY_FACT_IDS)[number];

export const STORY_MARK_FACT_IDS = [
  'alchemy_crafted',
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

export type StoryStatus = (typeof STORY_STATUSES)[number];

const factSchema = z.enum(STORY_FACT_IDS);

// 走到这一幕就开放的场景入口，写场景编号。
const unlocksSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(12)
  .optional();

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
    scene: z.string().trim().min(1).max(40),
    prompt: z.string().max(80),
    href: z.string().trim().min(1).max(120),
    unlocks: unlocksSchema,
    hail: hailSchema,
  })
  .strict();

const lessonIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const STORY_CLASSROOMS = ['alchemy', 'refinery'] as const;

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
    accept: z.array(acceptanceSchema).min(1).max(4),
    mode: z.enum(['any', 'all']).optional(),
    scene: z.string().trim().min(1).max(40),
    prompt: z.string().trim().min(1).max(80),
    href: z.string().trim().min(1).max(120),
    unlocks: unlocksSchema,
    hail: hailSchema,
    lesson: lessonIdSchema.optional(),
    // 破例一课：这一幕期间，身份不够的弟子也能进这间屋开一炉。
    classroom: z.enum(STORY_CLASSROOMS).optional(),
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
    unlocks: unlocksSchema,
    hail: hailSchema,
    when: z
      .object({
        fact: factSchema,
        prompt: z.string().trim().min(1).max(80),
        href: z.string().trim().min(1).max(120),
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
    unlocks: unlocksSchema,
    hail: hailSchema,
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
    unlocks: unlocksSchema,
    hail: hailSchema,
    grant: z.string().trim().min(1).max(40).optional(),
    reward: z.string().trim().min(1).max(40).optional(),
  })
  .strict();

export const StoryBeatSchema = z.discriminatedUnion('kind', [
  performanceBeatSchema,
  practiceBeatSchema,
  objectiveBeatSchema,
  waitBeatSchema,
  lifeBeatSchema,
]);

export function createStoryChapterSchema({
  getGuideLesson,
  hasStoryReward,
}: {
  getGuideLesson: (id: string) => unknown;
  hasStoryReward: (id: string) => boolean;
}) {
  const StoryChapterSchema = z
    .object({
      id: z.string().trim().min(1).max(80),
      track: z.enum(STORY_TRACKS),
      title: z.string().trim().min(1).max(40),
      // 这一章演完之后接哪一章。不写就停在最后一幕。
      next: z.string().trim().min(1).max(80).optional(),
      // 这一章期间只显示已开放的入口。不写就全部开放。
      gated: z.boolean().optional(),
      beats: z.array(StoryBeatSchema).min(1).max(40),
    })
    .strict()
    .superRefine((chapter, context) => {
      const ids = new Set<string>();
      const payouts = new Set<string>();
      if (!chapter.next && chapter.beats.at(-1)?.kind !== 'life') {
        context.addIssue({
          code: 'custom',
          message: '没有下一章的章节要停在常驻幕上',
        });
      }
      for (const beat of chapter.beats) {
        if (ids.has(beat.id)) {
          context.addIssue({
            code: 'custom',
            message: `剧情幕重复：${beat.id}`,
          });
        }
        ids.add(beat.id);
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
            /^base:[a-z0-9-]+:[a-z_]+=\d+$/.test(value) ||
            /^guide:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
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
    kind: z.enum(['performance', 'practice', 'objective', 'wait', 'life']),
    scene: z.string(),
    prompt: z.string(),
    href: z.string(),
    scriptId: z.string().nullable(),
    guideLesson: z.string().nullable(),
    classroom: z.enum(STORY_CLASSROOMS).nullable(),
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
    // 目标幕的各条目标。别的幕是空的。
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
  /** 眼下的境界。没给就当门槛没到。 */
  standing?: StoryStanding;
  /** 各项累计数眼下的值。 */
  counts?: Partial<Record<StoryCountId, number>>;
};

/** 一章里走到某一幕为止，沿途开放过的入口。不给幕就算整章。 */
export function chapterUnlocks(chapter: StoryChapter, uptoBeatId?: string) {
  const end = uptoBeatId
    ? chapter.beats.findIndex((beat) => beat.id === uptoBeatId)
    : chapter.beats.length - 1;
  return chapter.beats
    .slice(0, end + 1)
    .flatMap((beat) => beat.unlocks ?? []);
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
    dungeon_settled: false,
    qingxi_sought: false,
    qingxi_met: false,
    weapon_forged: false,
    weapon_equipped: false,
    sect_joined: false,
    sect_ready: false,
    breakthrough_available: false,
    consumable_used: false,
    market_bought: false,
    sect_trained: false,
  };
}
