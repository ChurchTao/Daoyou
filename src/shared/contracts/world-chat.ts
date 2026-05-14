import { z } from 'zod';

export const WorldChatTextMessageSchema = z.object({
  messageType: z.literal('text'),
  textContent: z.string().trim().optional(),
  payload: z
    .object({
      text: z.string().trim(),
    })
    .optional(),
});

export const WorldChatItemShowcaseMessageSchema = z.object({
  messageType: z.literal('item_showcase'),
  itemType: z.enum(['artifact', 'material', 'consumable']),
  itemId: z.string().trim().min(1),
  textContent: z.string().trim().max(100).optional(),
  payload: z
    .object({
      text: z.string().trim().max(100),
    })
    .optional(),
});

export const WorldChatCreateMessageSchema = z.discriminatedUnion('messageType', [
  WorldChatTextMessageSchema,
  WorldChatItemShowcaseMessageSchema,
]);

export const WorldChatListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export type WorldChatCreateMessageRequest = z.infer<
  typeof WorldChatCreateMessageSchema
>;
export type WorldChatListQuery = z.infer<typeof WorldChatListQuerySchema>;
