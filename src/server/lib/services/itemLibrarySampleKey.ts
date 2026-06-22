import { createHash } from 'crypto';

const SAMPLE_KEY_DENOMINATOR = 0x10000000000000; // 2^52

export function computeItemLibrarySampleKey(seed: string): number {
  const digest = createHash('sha256').update(seed).digest('hex');
  const first52Bits = Number.parseInt(digest.slice(0, 13), 16);
  return first52Bits / SAMPLE_KEY_DENOMINATOR;
}
