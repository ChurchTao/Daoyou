import { z } from 'zod';




export const SendMailSchema = z
  .object({
    requestId: z.string().min(1).max(120),
    recipientCultivatorId: z.uuid(),
    content: z.string().trim().min(1).max(1000),
    attachment: z
      .object({
        itemId: z.uuid(),
        revision: z.number().int().nonnegative(),
        quantity: z.number().int().min(1).max(99),
      })
      .strict()
      .optional(),
  })
  .strict();

export type SendMailRequest = z.infer<typeof SendMailSchema>;
