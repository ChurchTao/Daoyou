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

export const WorldChatItemShowcaseMessageSchema = z
  .object({
    messageType: z.literal('item_showcase'),
    itemId: z.string().trim().min(1).max(160),
    revision: z.number().int().nonnegative(),
    textContent: z.string().trim().max(100).optional(),
  })
  .strict();

export const WorldChatCreateMessageSchema = z.discriminatedUnion(
  'messageType',
  [WorldChatTextMessageSchema, WorldChatItemShowcaseMessageSchema],
  { error: '仅支持文字与道具消息，旧版战报分享已停用' },
);

export const WorldChatListQuerySchema = z.object({
  channel: z.enum(['all', 'system', 'world']).optional().default('world'),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const SectChatListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type WorldChatCreateMessageRequest = z.infer<
  typeof WorldChatCreateMessageSchema
>;
export type WorldChatListQuery = z.infer<typeof WorldChatListQuerySchema>;
export type SectChatListQuery = z.infer<typeof SectChatListQuerySchema>;
