import { describe, expect, it } from 'vitest';
import { TRANSFER_FORMAT_VERSION, TransferChallengeSchema, TransferPackageHeaderSchema } from './transfer.js';

const requestId = '00000000-0000-4000-8000-000000000001';
const userId = '00000000-0000-4000-8000-000000000002';

describe('transfer format version', () => {
  it('accepts the current version and rejects older challenges and snapshots', () => {
    const challenge = {
      version: TRANSFER_FORMAT_VERSION, requestId, targetServerId: 'target', targetUserId: userId,
      encryptionPublicKey: 'key', signingPublicKey: 'key', expiresAt: '2026-10-16T00:00:00.000Z',
    };
    const header = {
      version: TRANSFER_FORMAT_VERSION, exportId: requestId, sourceServerId: 'source',
      sourceCultivatorId: userId, targetServerId: 'target', targetRequestId: requestId,
      targetUserId: userId, exportedAt: '2026-10-16T00:00:00.000Z',
    };

    expect(TransferChallengeSchema.safeParse(challenge).success).toBe(true);
    expect(TransferPackageHeaderSchema.safeParse(header).success).toBe(true);
    expect(TransferChallengeSchema.safeParse({ ...challenge, version: 1 }).success).toBe(false);
    expect(TransferPackageHeaderSchema.safeParse({ ...header, version: 1 }).success).toBe(false);
  });
});
