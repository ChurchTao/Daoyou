import { SystemMailInputSchema } from '@daoyou/game-rules/mail';
import { z } from 'zod';
export const CreateSchema = z
  .object({ requestId: z.uuid(), input: SystemMailInputSchema })
  .strict();
export const UpdateSchema = z
  .object({
    revision: z.number().int().positive(),
    input: SystemMailInputSchema,
  })
  .strict();
export const RevisionSchema = z
  .object({ revision: z.number().int().positive() })
  .strict();
export const ListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().trim().max(200).default(''),
});
