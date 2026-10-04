import { createHash } from 'node:crypto';

export function hashSponsorshipClaimCode(code: string): string {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}
