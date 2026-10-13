import { z } from 'zod';

const MessageMeta = {
  clientMessageId: z.uuid().optional(),
  replyToMessageId: z.string().trim().min(1).max(160).optional(),
};

export const WorldChatTextMessageSchema = z.object({
  ...MessageMeta,
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
    ...MessageMeta,
    messageType: z.literal('item_showcase'),
    itemId: z.string().trim().min(1).max(160),
    revision: z.number().int().nonnegative(),
    textContent: z.string().trim().max(100).optional(),
  })
  .strict();

export const WorldChatBeastShowcaseMessageSchema = z.strictObject({
  ...MessageMeta,
  messageType: z.literal('beast_showcase'),
  beastId: z.uuid(),
  revision: z.number().int().nonnegative(),
  textContent: z.string().trim().max(100).optional(),
});

export const WorldChatCombatV6ReplayMessageSchema = z.strictObject({
  ...MessageMeta,
  messageType: z.literal('combat_v6_replay'),
  battleId: z.uuid(),
  textContent: z.string().trim().max(100).optional(),
});

export const WorldChatRedPacketMessageSchema = z.strictObject({
  clientMessageId: z.uuid(),
  messageType: z.literal('red_packet'),
  amount: z.number().int().min(50_000).max(10_000_000),
  count: z.number().int().min(1).max(100),
  mode: z.enum(['random', 'equal']),
  greeting: z
    .string()
    .trim()
    .refine((text) => Array.from(text).length <= 24)
    .default('仙途同庆，见者有份'),
});

export const WorldChatCreateMessageSchema = z.discriminatedUnion(
  'messageType',
  [
    WorldChatTextMessageSchema,
    WorldChatItemShowcaseMessageSchema,
    WorldChatBeastShowcaseMessageSchema,
    WorldChatCombatV6ReplayMessageSchema,
    WorldChatRedPacketMessageSchema,
  ],
  { error: '仅支持文字、道具、灵兽、战绩与红包消息' },
);

const CursorQuery = {
  beforeCursor: z.string().regex(/^\d+$/).optional(),
  afterCursor: z.string().regex(/^\d+$/).optional(),
  aroundMessageId: z.string().trim().min(1).max(160).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(30),
};

function validCursorQuery(query: {
  beforeCursor?: string;
  afterCursor?: string;
  aroundMessageId?: string;
}) {
  return (
    [query.beforeCursor, query.afterCursor, query.aroundMessageId].filter(
      Boolean,
    ).length <= 1 &&
    [query.beforeCursor, query.afterCursor].every(
      (cursor) => cursor === undefined || Number.isSafeInteger(Number(cursor)),
    )
  );
}

export const WorldChatListQuerySchema = z
  .object({
    ...CursorQuery,
    channel: z.enum(['all', 'system', 'world']).optional().default('world'),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    page: z.coerce.number().int().min(1).optional(),
  })
  .refine(validCursorQuery, '仅能指定一个有效消息游标');

export const SectChatListQuerySchema = z
  .object({
    ...CursorQuery,
    page: z.coerce.number().int().min(1).optional().default(1),
  })
  .refine(validCursorQuery, '仅能指定一个有效消息游标');

export type WorldChatCreateMessageRequest = z.infer<
  typeof WorldChatCreateMessageSchema
>;
export type WorldChatListQuery = z.infer<typeof WorldChatListQuerySchema>;
export type SectChatListQuery = z.infer<typeof SectChatListQuerySchema>;
