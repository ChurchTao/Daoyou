import { z } from 'zod';

export const OpenDirectConversationSchema = z
  .object({ cultivatorId: z.string().uuid() })
  .strict();
export const SendDirectMessageSchema = z
  .object({
    clientMessageId: z.string().uuid(),
    text: z
      .string()
      .trim()
      .refine((value) => {
        const length = Array.from(value).length;
        return length >= 1 && length <= 500;
      }, '消息长度需在 1–500 字之间'),
  })
  .strict();
export type SendDirectMessageRequest = z.infer<typeof SendDirectMessageSchema>;
export const ReadDirectMessagesSchema = z
  .object({ messageId: z.string().uuid() })
  .strict();
export const DirectMessagesQuerySchema = z
  .object({
    beforeCursor: z
      .string()
      .regex(/^\d+$/)
      .refine((value) => Number.isSafeInteger(Number(value)))
      .optional(),
    afterCursor: z
      .string()
      .regex(/^\d+$/)
      .refine((value) => Number.isSafeInteger(Number(value)))
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine(
    (value) => !(value.beforeCursor && value.afterCursor),
    '不能同时指定前后游标',
  );
export type DirectMessagesQuery = z.infer<typeof DirectMessagesQuerySchema>;
export const DirectConversationsQuerySchema = z.object({
  beforeCursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type DirectConversationsQuery = z.infer<
  typeof DirectConversationsQuerySchema
>;
export interface DirectConversationsPage {
  conversations: DirectConversationDTO[];
  pagination: { nextCursor: string | null; hasMore: boolean };
}

export interface DirectConversationDTO {
  id: string;
  peer: { cultivatorId: string | null; name: string };
  myCultivatorId: string | null;
  archived: boolean;
  canSend: boolean;
  unavailableReason: string | null;
  lastSequence: number;
  lastReadSequence: number;
  unreadCount: number;
  lastMessage: {
    text: string | null;
    mine: boolean;
    createdAt: string;
    expired: boolean;
  } | null;
  updatedAt: string;
}
export interface DirectMessageDTO {
  id: string;
  conversationId: string;
  sequence: number;
  clientMessageId: string;
  senderName: string;
  senderCultivatorId: string | null;
  mine: boolean;
  text: string | null;
  expired: boolean;
  createdAt: string;
}
export interface DirectMessagesPage {
  conversation: DirectConversationDTO;
  messages: DirectMessageDTO[];
  pagination: {
    beforeCursor: string | null;
    afterCursor: string;
    hasMoreBefore: boolean;
    hasMoreAfter: boolean;
  };
}
