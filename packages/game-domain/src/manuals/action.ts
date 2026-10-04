import { z } from 'zod';

const target = {
  expectedRevision: z.number().int().nonnegative(),
  slot: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  manualId: z.string().min(1).max(160),
};

const item = z.strictObject({
  id: z.string().min(1).max(160),
  revision: z.number().int().nonnegative(),
});

export const ManualActionSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('learn'), ...target, item }),
  z.strictObject({ action: z.literal('unlock'), ...target, item }),
  z.strictObject({ action: z.literal('train'), ...target }),
  z.strictObject({ action: z.literal('activate'), ...target }),
]);

export type ManualAction = z.infer<typeof ManualActionSchema>;
