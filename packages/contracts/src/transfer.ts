import { z } from 'zod';

export const TRANSFER_FORMAT_VERSION = 2;
export const TRANSFER_PENDING_NOTE = '角色正在跨服转移，等待目标服审核回执';
export const TRANSFERRED_NOTE = '角色已转出至其他服务器';

export const TransferChallengeSchema = z.strictObject({
  version: z.literal(TRANSFER_FORMAT_VERSION),
  requestId: z.uuid(),
  targetServerId: z.string().regex(/^[A-Za-z0-9._-]{1,160}$/),
  targetUserId: z.uuid(),
  encryptionPublicKey: z.string().min(1).max(8192),
  signingPublicKey: z.string().min(1).max(4096),
  expiresAt: z.iso.datetime(),
});

export const TransferPackageHeaderSchema = z.strictObject({
  version: z.literal(TRANSFER_FORMAT_VERSION),
  exportId: z.uuid(),
  sourceServerId: z.string().regex(/^[A-Za-z0-9._-]{1,160}$/),
  sourceCultivatorId: z.uuid(),
  targetServerId: z.string().regex(/^[A-Za-z0-9._-]{1,160}$/),
  targetRequestId: z.uuid(),
  targetUserId: z.uuid(),
  exportedAt: z.iso.datetime(),
});

export type TransferChallenge = z.infer<typeof TransferChallengeSchema>;
export type TransferPackageHeader = z.infer<typeof TransferPackageHeaderSchema>;
