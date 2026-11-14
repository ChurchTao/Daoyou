import type {
  AdminWorldChatMute,
  AdminWorldChatMuteRequest,
} from '@daoyou/contracts/admin/world-chat';
import { ChatError } from '@server/social/application/chatError.js';
import { z } from 'zod';
import { redis } from './index.js';

const MuteSchema = z.strictObject({
  userId: z.uuid(),
  reason: z.string().min(1).max(200),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  createdBy: z.uuid(),
});

function muteKey(userId: string) {
  return `world_chat:mute:${userId}`;
}

export async function listWorldChatMutes(
  userIds: string[],
): Promise<Record<string, AdminWorldChatMute>> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return {};
  const values = await redis.mget(...ids.map(muteKey));
  const mutes: Record<string, AdminWorldChatMute> = {};
  values.forEach((value, index) => {
    if (value === null) return;
    const mute = MuteSchema.parse(JSON.parse(value));
    if (mute.userId !== ids[index])
      throw new Error('World chat mute account mismatch');
    mutes[mute.userId] = mute;
  });
  return mutes;
}

export async function assertWorldChatCanSend(userId: string) {
  const mute = (await listWorldChatMutes([userId]))[userId];
  if (!mute) return;
  const until = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    dateStyle: 'short',
    timeStyle: 'short',
    hour12: false,
  }).format(new Date(mute.expiresAt));
  throw new ChatError(`世界频道已被禁言至 ${until}，原因：${mute.reason}`, 403);
}

export async function setWorldChatMute(
  userId: string,
  createdBy: string,
  input: AdminWorldChatMuteRequest,
): Promise<AdminWorldChatMute> {
  const now = Date.now();
  const mute: AdminWorldChatMute = {
    userId,
    createdBy,
    reason: input.reason,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + input.durationMinutes * 60_000).toISOString(),
  };
  // SET with EX is atomic: creating/replacing a mute always also sets its TTL.
  await redis.set(
    muteKey(userId),
    JSON.stringify(mute),
    'EX',
    input.durationMinutes * 60,
  );
  return mute;
}

export async function removeWorldChatMute(userId: string) {
  await redis.del(muteKey(userId));
}
