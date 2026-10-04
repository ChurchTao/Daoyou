import { z } from 'zod';

export const DivineFortuneSchema = z.object({
  fortune: z.string().min(1),
  hint: z.string().min(1),
});

export type DivineFortune = z.infer<typeof DivineFortuneSchema>;
