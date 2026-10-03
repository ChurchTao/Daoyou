export const SECT_TASK_ABANDON_COOLDOWN_MS = 15 * 60 * 1_000;

export interface SectTaskAbandonAvailability {
  allowed: boolean;
  availableAt: Date;
  remainingMs: number;
}

export function resolveSectTaskAbandonAvailability(
  acceptedAt: Date,
  now: Date,
): SectTaskAbandonAvailability {
  const availableAt = new Date(
    acceptedAt.getTime() + SECT_TASK_ABANDON_COOLDOWN_MS,
  );
  const remainingMs = Math.max(0, availableAt.getTime() - now.getTime());
  return {
    allowed: remainingMs === 0,
    availableAt,
    remainingMs,
  };
}
