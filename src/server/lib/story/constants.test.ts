import { describe, expect, it } from 'vitest';
import {
  PERSONAL_STORY_COOLDOWN_MS,
  isNextPersonalStoryGenerationDue,
} from './constants';

describe('personal story scheduling rules', () => {
  it('uses a one-day cooldown after a completed chapter', () => {
    expect(PERSONAL_STORY_COOLDOWN_MS).toBe(24 * 60 * 60 * 1_000);
  });

  it('only schedules the next chapter after the previous cooldown expires', () => {
    const now = new Date('2026-08-25T12:00:00.000Z');

    expect(
      isNextPersonalStoryGenerationDue({
        activeThreadId: null,
        cooldownUntil: new Date('2026-08-25T11:59:59.000Z'),
        now,
      }),
    ).toBe(true);
    expect(
      isNextPersonalStoryGenerationDue({
        activeThreadId: '00000000-0000-4000-8000-000000000001',
        cooldownUntil: new Date('2026-08-25T11:59:59.000Z'),
        now,
      }),
    ).toBe(false);
    expect(
      isNextPersonalStoryGenerationDue({
        activeThreadId: null,
        cooldownUntil: new Date('2026-08-25T12:00:01.000Z'),
        now,
      }),
    ).toBe(false);
    expect(
      isNextPersonalStoryGenerationDue({
        activeThreadId: null,
        cooldownUntil: null,
        now,
      }),
    ).toBe(false);
  });
});
