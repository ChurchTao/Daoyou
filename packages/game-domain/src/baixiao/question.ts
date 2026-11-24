import { z } from 'zod';

export const BaixiaoCategorySchema = z.enum([
  'literature',
  'history',
  'riddle',
  'science',
]);
export const BaixiaoDifficultySchema = z.enum(['easy', 'medium', 'hard']);

export const BaixiaoQuestionSchema = z
  .object({
    knowledgeKey: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9-]{1,99}$/),
    category: BaixiaoCategorySchema,
    difficulty: BaixiaoDifficultySchema,
    kind: z.enum(['choice', 'judgment']),
    prompt: z.string().trim().min(2).max(180),
    options: z.array(z.string().trim().min(1).max(64)).min(2).max(4),
    correct: z.number().int().min(0).max(3),
    explanation: z.string().trim().min(2).max(280),
    source: z.string().trim().min(2).max(240),
  })
  .strict()
  .superRefine((item, context) => {
    const options = item.options.map((option) =>
      option.normalize('NFKC').toLowerCase(),
    );
    const validOptions =
      item.kind === 'choice'
        ? options.length === 4 && new Set(options).size === 4
        : options.length === 2 && options[0] === '是' && options[1] === '否';
    if (!validOptions || item.correct >= options.length) {
      context.addIssue({
        code: 'custom',
        path: ['options'],
        message:
          '单选题须有四个不同选项；是非题使用「是、否」。正确项必须在选项内。',
      });
    }
  });

export type BaixiaoQuestionData = z.infer<typeof BaixiaoQuestionSchema>;
