import { z } from 'zod';

export const JournalChangeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('resource'),
    resource: z.enum([
      'spiritStones',
      'exp',
      'insight',
      'reputation',
      'contribution',
    ]),
    amount: z.number().refine((value) => value !== 0),
  }),
  z.object({
    kind: z.literal('item'),
    id: z.string(),
    name: z.string(),
    amount: z
      .number()
      .int()
      .refine((value) => value !== 0),
  }),
]);

export type JournalChange = z.infer<typeof JournalChangeSchema>;
