import { ACHIEVEMENT_DEFINITIONS } from '@daoyou/game-content/achievements';
import type { AchievementFacts } from '@daoyou/game-domain/achievements';
import { describe, expect, it } from 'vitest';
import {
  achievementCatalogue,
  achievementProgress,
  eligibleAchievementIds,
} from './achievements.js';

const facts = (graduates: number, bound = false): AchievementFacts => ({
  metrics: {
    'mentorship.bound': Number(bound),
    'mentorship.graduated_disciples': graduates,
  },
  labels: { mentorName: '青岚' },
});

describe('achievement rules', () => {
  it.each([2, 6, 12, 20, 30])(
    'requires the exact graduation boundary %i',
    (target) => {
      const id = `mentorship.graduates.${target}`;
      expect(eligibleAchievementIds(facts(target - 1))).not.toContain(id);
      expect(eligibleAchievementIds(facts(target))).toContain(id);
      expect(eligibleAchievementIds(facts(target + 1))).toContain(id);
    },
  );

  it('keeps all reached milestone achievements', () => {
    expect(eligibleAchievementIds(facts(30))).toEqual([
      'mentorship.graduates.2',
      'mentorship.graduates.6',
      'mentorship.graduates.12',
      'mentorship.graduates.20',
      'mentorship.graduates.30',
    ]);
  });

  it('uses registration metrics for future counters without new core branches', () => {
    const definition = {
      id: 'craft.master',
      name: '百炼成器',
      description: '',
      condition: '',
      requirement: { metric: 'craft.completed', target: 100 },
    };
    expect(
      achievementProgress(definition, { metrics: { 'craft.completed': 99 } }),
    ).toEqual({ current: 99, target: 100 });
    expect(
      achievementProgress(definition, { metrics: { 'craft.completed': 200 } }),
    ).toEqual({ current: 100, target: 100 });
    expect(
      achievementProgress(definition, { metrics: { unrelated: 200 } }),
    ).toEqual({ current: 0, target: 100 });
  });

  it('shows condition progress without unlocking from an arbitrary client fact', () => {
    const catalogue = achievementCatalogue(facts(2, true), []);
    expect(
      catalogue.every((item) => !item.unlocked && item.unlockedAt === null),
    ).toBe(true);
    expect(
      catalogue.find((item) => item.id === 'mentorship.graduates.2')?.progress,
    ).toEqual({ current: 2, target: 2 });
  });

  it('keeps a permanent unlock even if its historical counter later disappears', () => {
    const item = achievementCatalogue(facts(0), [
      {
        achievementId: 'mentorship.graduates.2',
        unlockedAt: '2026-11-13T00:00:00.000Z',
      },
    ]).find((entry) => entry.id === 'mentorship.graduates.2');
    expect(item?.unlocked).toBe(true);
    expect(item?.progress).toEqual({ current: 2, target: 2 });
  });

  it('derives the apprentice display name from current authoritative labels', () => {
    const unlocked = [
      {
        achievementId: 'mentorship.apprentice',
        unlockedAt: '2026-11-13T00:00:00.000Z',
      },
    ];
    expect(achievementCatalogue(facts(0, true), unlocked)[0]?.name).toBe(
      '青岚之徒',
    );
    expect(
      achievementCatalogue(
        {
          metrics: { 'mentorship.bound': 1 },
          labels: { mentorName: '已注销道友' },
        },
        unlocked,
      )[0]?.name,
    ).toBe('已注销道友之徒');
  });

  it.each([undefined, {}, { mentorName: '   ' }])(
    'falls back to the registered name when a template label is absent',
    (labels) => {
      expect(
        achievementCatalogue({ metrics: {}, labels }, [
          {
            achievementId: 'mentorship.apprentice',
            unlockedAt: '2026-11-13T00:00:00.000Z',
          },
        ])[0]?.name,
      ).toBe('师承有道');
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    'does not count an invalid metric %s',
    (current) => {
      expect(
        achievementProgress(ACHIEVEMENT_DEFINITIONS[1]!, {
          metrics: { 'mentorship.graduated_disciples': current },
        }),
      ).toEqual({ current: 0, target: 2 });
    },
  );

  it.each([
    0,
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])('rejects an invalid target %s before checking unlocks', (target) => {
    expect(() =>
      achievementProgress(
        {
          ...ACHIEVEMENT_DEFINITIONS[1]!,
          requirement: { metric: 'mentorship.graduated_disciples', target },
        },
        facts(100),
      ),
    ).toThrow(RangeError);
  });

  it('does not display an unknown historical achievement as a current definition', () => {
    expect(
      achievementCatalogue(facts(0), [
        {
          achievementId: 'retired.unknown',
          unlockedAt: '2026-11-13T00:00:00.000Z',
        },
      ]),
    ).toHaveLength(ACHIEVEMENT_DEFINITIONS.length);
  });
});
