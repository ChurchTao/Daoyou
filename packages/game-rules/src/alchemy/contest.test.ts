import {
  ContestPaperSchema,
  type ContestAttempt,
  type ContestMaterial,
} from '@daoyou/game-domain/alchemy/contest';
import { describe, expect, it } from 'vitest';
import {
  brewContestFurnace,
  compareContestStandings,
  contestBudget,
  contestRewardForRank,
  contestStanding,
  contestWeek,
  scoreContestFurnace,
  validContestRecipe,
} from './contest.js';
import { authorContestQuestion } from './contestAuthoring.js';

const materials: ContestMaterial[] = Array.from({ length: 16 }, (_, index) => ({
  id: `test-${index}`,
  name: `试材${index}`,
  description: '试炉所用灵材',
  type: index % 3 === 1 ? 'aux' : index % 3 === 2 ? 'tcdb' : 'herb',
  rank: index % 3 === 0 ? '玄品' : '灵品',
  element: '木',
  properties:
    index % 4 === 0
      ? [
          { key: 'restore_mp', weight: 0.67 },
          { key: 'heal_wounds', weight: 0.33 },
        ]
      : index % 4 === 1
        ? [
            { key: 'restore_mp', weight: 0.8 },
            { key: 'heal_wounds', weight: 0.2 },
          ]
        : index % 4 === 2
          ? [
              { key: 'heal_wounds', weight: 0.75 },
              { key: 'detox', weight: 0.25 },
            ]
          : [
              { key: 'clear_mind_support', weight: 0.75 },
              { key: 'restore_mp', weight: 0.25 },
            ],
}));
const draft = {
  title: '回灵试',
  brief: '兼顾疗伤',
  primary: 'restore_mp',
  secondary: 'heal_wounds',
} as const;
const question = {
  ...draft,
  pillName: '葆元丹',
  minimumStrength: 0.01,
  maximumToxicity: 30,
  strengthForFullScore: 0.2,
  quantityForFullScore: 4,
};
const selected = [
  { ...materials[0], dose: 2 },
  { ...materials[1], dose: 1 },
];
const doses = selected.map(({ id, dose }) => ({ materialId: id, dose }));

describe('炼丹大会', () => {
  it('以北京时间的星期三确定期次和个人完整开局时间', () => {
    const round = contestWeek(Date.parse('2026-11-22T16:00:00Z'));
    expect(round.week).toBe('2026-11-25');
    expect(new Date(round.opensAt).toISOString()).toBe(
      '2026-11-25T06:00:00.000Z',
    );
    expect(new Date(round.lastStartAt).toISOString()).toBe(
      '2026-11-25T07:45:00.000Z',
    );
    expect(new Date(round.closesAt).toISOString()).toBe(
      '2026-11-25T08:00:00.000Z',
    );
    expect(contestWeek(round.closesAt, 1).week).toBe('2026-12-02');
  });

  it('固定配方的波动只计入品相，并约束单炉和累计消耗', () => {
    const brewed = brewContestFurnace(selected, 'fierce');
    const low = scoreContestFurnace(brewed, question, 'fierce', 0, -1);
    const high = scoreContestFurnace(brewed, question, 'fierce', 0, 1);
    const base = scoreContestFurnace(brewed, question, 'fierce', 0, 0);
    expect(base.qualified).toBe(true);
    expect(low.effects).toEqual(high.effects);
    expect(low.qualifiedLots).toEqual(high.qualifiedLots);
    expect(low.toxicity).toEqual(high.toxicity);
    expect(high.points.appearance - base.points.appearance).toBeCloseTo(1);
    expect(base.points.appearance - low.points.appearance).toBeCloseTo(1);
    const first: ContestAttempt = {
      ...base,
      doses,
      heat: 'fierce',
      acceptedAt: '2026-11-25T06:20:00Z',
    };
    const next = {
      ...first,
      qualified: false,
      doses: [
        { ...doses[0], dose: 1 },
        { ...doses[1], dose: 2 },
      ],
    };
    expect(
      validContestRecipe(
        { doses, heat: 'fierce' },
        contestBudget(materials, []),
      ),
    ).toBe(true);
    expect(
      validContestRecipe(
        { doses, heat: 'fierce' },
        contestBudget(materials, [first]),
      ),
    ).toBe(false);
    expect(contestBudget(materials, [first, next]).qi).toBe(1);
    expect(contestStanding(materials, [first, next])!.score).toBeLessThan(
      contestStanding(materials, [first])!.score,
    );
  });

  it('给可修方的样题设定门槛，拒绝无法达标或无法识别的考卷', () => {
    const authored = authorContestQuestion(draft, materials);
    expect(authored).not.toBeNull();
    expect(
      ContestPaperSchema.safeParse({
        rulesVersion: 1,
        question: { ...authored, pillName: question.pillName },
        materials,
      }).success,
    ).toBe(true);
    expect(
      authorContestQuestion(
        { ...draft, primary: 'extend_lifespan' },
        materials,
      ),
    ).toBeNull();
    expect(
      ContestPaperSchema.safeParse({ rulesVersion: 2, question, materials })
        .success,
    ).toBe(false);
  });

  it('同分比较药效和耗材，并保持各名次奖励边界', () => {
    const base = { score: 60, effectScore: 40, usedMaterials: 5 };
    expect(compareContestStandings(base, { ...base })).toBe(0);
    expect(
      compareContestStandings(base, {
        ...base,
        effectScore: 39,
        usedMaterials: 4,
      }),
    ).toBeLessThan(0);
    expect(
      compareContestStandings(base, { ...base, usedMaterials: 6 }),
    ).toBeLessThan(0);
    expect(
      [1, 2, 3, 4, 10, 11, 50, 51, 100, 101].map(
        (rank) => contestRewardForRank(rank).reputation,
      ),
    ).toEqual([300, 200, 200, 200, 200, 100, 100, 50, 50, 0]);
    expect(contestRewardForRank(101).odds).toEqual(
      contestRewardForRank(100).odds,
    );
  });
});
