import { z } from 'zod';
import type {
  WorldChatMessageDTO,
  WorldChatPagination,
} from './world-chat-messages.js';

export const AdminWorldChatMuteRequestSchema = z.strictObject({
  durationMinutes: z.number().int().min(1).max(1_440),
  reason: z.string().trim().min(1, '请填写禁言原因').max(200),
});

export type AdminWorldChatMuteRequest = z.infer<
  typeof AdminWorldChatMuteRequestSchema
>;

export interface AdminWorldChatMute {
  userId: string;
  reason: string;
  expiresAt: string;
  createdAt: string;
  createdBy: string;
}

export interface AdminWorldChatMessagesResponse {
  success: true;
  data: WorldChatMessageDTO[];
  pagination: WorldChatPagination;
  mutes: Record<string, AdminWorldChatMute>;
}
