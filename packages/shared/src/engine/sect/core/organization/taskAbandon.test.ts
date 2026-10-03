import { describe, expect, it } from 'vitest';
import {
  SECT_TASK_ABANDON_COOLDOWN_MS,
  resolveSectTaskAbandonAvailability,
} from './taskAbandon.js';

describe('sect task abandon availability', () => {
  const acceptedAt = new Date('2026-08-04T04:00:00.000Z');

  it('blocks abandonment before the fifteen-minute cooldown ends', () => {
    const result = resolveSectTaskAbandonAvailability(
      acceptedAt,
      new Date(acceptedAt.getTime() + SECT_TASK_ABANDON_COOLDOWN_MS - 1),
    );

    expect(result).toEqual({
      allowed: false,
      availableAt: new Date('2026-08-04T04:15:00.000Z'),
      remainingMs: 1,
    });
  });

  it('allows abandonment exactly when the cooldown ends', () => {
    const result = resolveSectTaskAbandonAvailability(
      acceptedAt,
      new Date(acceptedAt.getTime() + SECT_TASK_ABANDON_COOLDOWN_MS),
    );

    expect(result.allowed).toBe(true);
    expect(result.remainingMs).toBe(0);
  });

  it('keeps abandonment available after the cooldown has ended', () => {
    const result = resolveSectTaskAbandonAvailability(
      acceptedAt,
      new Date(acceptedAt.getTime() + SECT_TASK_ABANDON_COOLDOWN_MS + 60_000),
    );

    expect(result.allowed).toBe(true);
    expect(result.remainingMs).toBe(0);
  });
});
