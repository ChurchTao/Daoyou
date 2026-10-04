import { z } from 'zod';


const reference = {
  membershipId: z.uuid(),
  expectedRevision: z.number().int().nonnegative(),
};

export const SectV6ActionSchema = z.discriminatedUnion('action', [
  z
    .object({
      ...reference,
      action: z.literal('train'),
      methodId: z.string().min(1).max(160),
      targetLevel: z.number().int().min(1).max(180).optional(),
    })
    .strict(),
  z.object({ ...reference, action: z.literal('unlock') }).strict(),
  z
    .object({
      ...reference,
      action: z.literal('save'),
      pathId: z.string().min(1).max(160),
      nodeIds: z.array(z.string().min(1).max(160)).max(7),
    })
    .strict(),
  z
    .object({
      ...reference,
      action: z.literal('activate'),
      pathId: z.string().min(1).max(160),
    })
    .strict(),
]);

export type SectV6Action = z.infer<typeof SectV6ActionSchema>;

export interface SectV6Cost {
  cultivationExp: number;
  spiritStones: number;
  comprehensionInsight: number;
}
