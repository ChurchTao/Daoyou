import { z } from 'zod';

const anchorSchema = z.string().trim().min(1).max(80);
const textSchema = z.string().trim().min(1).max(160);

const lookStepSchema = z
  .object({
    type: z.literal('look'),
    anchor: anchorSchema,
    text: textSchema,
  })
  .strict();

const pressStepSchema = z
  .object({
    type: z.literal('press'),
    anchor: anchorSchema,
    text: textSchema,
  })
  .strict();

const endStepSchema = z
  .object({
    type: z.literal('end'),
  })
  .strict();

export const GuideStepSchema = z.discriminatedUnion('type', [
  lookStepSchema,
  pressStepSchema,
  endStepSchema,
]);

export const GuideLessonSchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(40),
    steps: z.array(GuideStepSchema).min(2).max(12),
  })
  .strict()
  .superRefine((lesson, context) => {
    const last = lesson.steps.at(-1);
    if (last?.type !== 'end') {
      context.addIssue({ code: 'custom', message: '教学要以收束结束' });
    }
    if (!lesson.steps.some((step) => step.type === 'look' || step.type === 'press')) {
      context.addIssue({ code: 'custom', message: '教学还没有要看的一步' });
    }
  });

export type GuideStep = z.infer<typeof GuideStepSchema>;
export type GuideLesson = z.infer<typeof GuideLessonSchema>;

export function parseGuideLesson(input: unknown): GuideLesson {
  return GuideLessonSchema.parse(input);
}
