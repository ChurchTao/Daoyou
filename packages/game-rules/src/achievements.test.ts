import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_DEFINITIONS,
  ACHIEVEMENT_SERIES,
} from '@daoyou/game-content/achievements';
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
  it.each(ACHIEVEMENT_DEFINITIONS)(
    'requires the registered metric boundary for $id',
    (definition) => {
      const { metric, target } = definition.requirement;
      expect(
        eligibleAchievementIds({ metrics: { [metric]: target - 1 } }),
      ).not.toContain(definition.id);
      expect(
        eligibleAchievementIds({ metrics: { [metric]: target } }),
      ).toContain(definition.id);
      expect(
        achievementProgress(definition, { metrics: { [metric]: target + 1 } }),
      ).toEqual({ current: target, target });
    },
  );

  it('keeps content identities unique and series tiers internally consistent', () => {
    expect(new Set(ACHIEVEMENT_DEFINITIONS.map((item) => item.id)).size).toBe(
      ACHIEVEMENT_DEFINITIONS.length,
    );
    expect(new Set(ACHIEVEMENT_SERIES.map((item) => item.id)).size).toBe(
      ACHIEVEMENT_SERIES.length,
    );
    const categories = new Set(ACHIEVEMENT_CATEGORIES.map((item) => item.id));
    for (const series of ACHIEVEMENT_SERIES) {
      expect(categories.has(series.category)).toBe(true);
      expect(series.action?.href.startsWith('/game')).toBe(true);
      const definitions = ACHIEVEMENT_DEFINITIONS.filter(
        (definition) => definition.seriesId === series.id,
      );
      expect(definitions.length).toBeGreaterThan(0);
      expect(definitions.map((definition) => definition.tier)).toEqual(
        definitions.map((_, index) => index + 1),
      );
      expect(
        new Set(definitions.map((item) => item.requirement.metric)).size,
      ).toBe(1);
      for (let index = 0; index < definitions.length; index++) {
        const definition = definitions[index]!;
        expect(Number.isSafeInteger(definition.requirement.target)).toBe(true);
        expect(definition.requirement.target).toBeGreaterThan(
          definitions[index - 1]?.requirement.target ?? 0,
        );
      }
    }
    for (const definition of ACHIEVEMENT_DEFINITIONS)
      expect(
        ACHIEVEMENT_SERIES.some((series) => series.id === definition.seriesId),
      ).toBe(true);
  });

  it('projects self-contained series metadata without changing trusted unlock rules', () => {
    const item = achievementCatalogue(
      { metrics: { 'alchemy.crafts': 9 } },
      [],
    ).find((achievement) => achievement.id === 'alchemy.crafts.10');
    expect(item).toMatchObject({
      category: 'craft',
      categoryLabel: '丹器',
      seriesId: 'alchemy.crafts',
      seriesName: '丹火不息',
      tier: 2,
      unit: '次',
      action: { label: '前往炼丹', href: '/game/craft/alchemy' },
      trackingHint: '按本角色已记录的玩法次数累计，无法确认的历史不补计。',
      unlocked: false,
      progress: { current: 9, target: 10 },
    });
  });

  it('gives realm stages a textual condition instead of a fabricated count unit', () => {
    const item = achievementCatalogue(
      { metrics: { 'cultivation.realm_rank': 3 } },
      [],
    ).find((achievement) => achievement.id === 'cultivation.realm.4');
    expect(item).toMatchObject({
      unit: '',
      condition: '境界达到化神期',
      progress: { current: 3, target: 4 },
    });
  });

  it('keeps snapshots and counters separate in the authored tracking explanation', () => {
    const byId = new Map(
      ACHIEVEMENT_SERIES.map((series) => [series.id, series]),
    );
    expect(byId.get('spirit_field.harvests')?.tracking).toBe('snapshot');
    expect(byId.get('beasts.fusions')?.tracking).toBe('snapshot');
    expect(byId.get('alchemy.crafts')?.tracking).toBe('counter');
    expect(byId.get('dungeon.completions')?.tracking).toBe('counter');
  });

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

  it('exposes a specific blocking reason only on its locked achievement', () => {
    const catalogue = achievementCatalogue(
      {
        metrics: {},
        blockedAchievements: {
          'mentorship.apprentice': '当前境界已无法拜师',
        },
      },
      [],
    );
    expect(
      catalogue.find((item) => item.id === 'mentorship.apprentice'),
    ).toMatchObject({
      unlocked: false,
      blockedReason: '当前境界已无法拜师',
      progress: { current: 0, target: 1 },
    });
    expect(
      catalogue.find((item) => item.id === 'mentorship.graduates.2'),
    ).not.toHaveProperty('blockedReason');
  });

  it('keeps an unlocked achievement free of later blocking reasons', () => {
    const item = achievementCatalogue(
      {
        metrics: {},
        blockedAchievements: {
          'mentorship.apprentice': '当前境界已无法拜师',
        },
      },
      [
        {
          achievementId: 'mentorship.apprentice',
          unlockedAt: '2026-11-13T00:00:00.000Z',
        },
      ],
    ).find((achievement) => achievement.id === 'mentorship.apprentice');
    expect(item).toMatchObject({
      unlocked: true,
      progress: { current: 1, target: 1 },
    });
    expect(item).not.toHaveProperty('blockedReason');
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
