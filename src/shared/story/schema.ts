import { z } from 'zod';
import { getGuideLesson } from '../guide/catalog';
import { hasStoryReward } from './grants';

export const STORY_FACT_IDS = [
  'starter_beast',
  'alchemy_crafted',
  'dungeon_settled',
  'sect_joined',
  'breakthrough_available',
] as const;

export type StoryFactId = (typeof STORY_FACT_IDS)[number];

export const STORY_MARK_FACT_IDS = [
  'alchemy_crafted',
  'dungeon_settled',
] as const satisfies readonly StoryFactId[];

export const STORY_TRACKS = ['main', 'encounter'] as const;

export type StoryTrack = (typeof STORY_TRACKS)[number];

export const STORY_STATUSES = ['active', 'completed'] as const;

export type StoryStatus = (typeof STORY_STATUSES)[number];

const factSchema = z.enum(STORY_FACT_IDS);

const performanceBeatSchema = z
  .object({
    id: z.string().trim().min(1).max(40),
    kind: z.literal('performance'),
    script: z.string().trim().min(1).max(80),
    outcome: z.string().trim().min(1).max(40),
    scene: z.string().trim().min(1).max(40),
    prompt: z.string().max(80),
    href: z.string().trim().min(1).max(120),
  })
  .strict();

const lessonIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

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

export const StoryBeatSchema = z.discriminatedUnion('kind', [
  performanceBeatSchema,
  practiceBeatSchema,
  lifeBeatSchema,
]);

export const StoryChapterSchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    track: z.enum(STORY_TRACKS),
    title: z.string().trim().min(1).max(40),
    beats: z.array(StoryBeatSchema).min(1).max(40),
  })
  .strict()
  .superRefine((chapter, context) => {
    const ids = new Set<string>();
    const payouts = new Set<string>();
    for (const beat of chapter.beats) {
      if (ids.has(beat.id)) {
        context.addIssue({
          code: 'custom',
          message: `剧情幕重复：${beat.id}`,
        });
      }
      ids.add(beat.id);
      if (beat.kind !== 'practice') continue;
      const guides = beat.accept.filter((entry) => entry.type === 'guide');
      if (guides.length > 1) {
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
    kind: z.enum(['performance', 'practice', 'life']),
    scene: z.string(),
    prompt: z.string(),
    href: z.string(),
    scriptId: z.string().nullable(),
    guideLesson: z.string().nullable(),
  })
  .strict();

export type StoryBeat = z.infer<typeof StoryBeatSchema>;
export type StoryChapter = z.infer<typeof StoryChapterSchema>;
export type StoryProgress = z.infer<typeof StoryProgressSchema>;
export type StoryView = z.infer<typeof StoryViewSchema>;

export type StoryFacts = Record<StoryFactId, boolean>;

export function emptyStoryFacts(): StoryFacts {
  return {
    starter_beast: false,
    alchemy_crafted: false,
    dungeon_settled: false,
    sect_joined: false,
    breakthrough_available: false,
  };
}
