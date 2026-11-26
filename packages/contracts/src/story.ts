import { z } from 'zod';

const id = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const CompleteStoryPassageSchema = z
  .object({
    chapterId: id,
    beatId: id,
    passageId: id,
  })
  .strict();

export type CompleteStoryPassage = z.infer<typeof CompleteStoryPassageSchema>;
