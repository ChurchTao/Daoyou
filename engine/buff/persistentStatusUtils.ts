import type { BuffInstanceState } from './types';

export type PersistentStatusMetadata = {
  expiresAt?: number;
  usesRemaining?: number;
};

export function isPersistentStatusValid(
  metadata?: PersistentStatusMetadata,
  now: number = Date.now(),
): boolean {
  if (!metadata) return true;

  if (metadata.expiresAt && metadata.expiresAt > 0 && now > metadata.expiresAt) {
    return false;
  }

  if (metadata.usesRemaining !== undefined && metadata.usesRemaining <= 0) {
    return false;
  }

  return true;
}

export function getValidPersistentStatuses(
  statuses?: BuffInstanceState[],
  now: number = Date.now(),
): BuffInstanceState[] {
  return (statuses ?? []).filter((status) =>
    isPersistentStatusValid(
      status.metadata as PersistentStatusMetadata | undefined,
      now,
    ),
  );
}

export function hasDirtyPersistentStatuses(
  statuses?: BuffInstanceState[],
  now: number = Date.now(),
): boolean {
  const originalCount = statuses?.length ?? 0;
  const validCount = getValidPersistentStatuses(statuses, now).length;
  return originalCount > validCount;
}
