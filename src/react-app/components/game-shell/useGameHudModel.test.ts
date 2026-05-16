import { buildGameHudSnapshot } from './useGameHudModel';
import { describe, expect, it } from 'vitest';

describe('buildGameHudSnapshot', () => {
  it('derives hud metrics from condition, cultivation progress and mail count', () => {
    const snapshot = buildGameHudSnapshot({
      cultivator: {
        name: '林玄',
        title: '照夜抄经人',
        realm_stage: '筑基中期',
        spirit_stones: 1280,
        cultivation_progress: {
          cultivation_exp: 72,
          exp_cap: 100,
          comprehension_insight: 41,
          breakthrough_failures: 0,
          bottleneck_state: false,
          inner_demon: false,
          deviation_risk: 0,
        },
        condition: {
          version: 1,
          resources: {
            hp: { current: 312 },
            mp: { current: 85 },
          },
          gauges: {
            pillToxicity: 240,
          },
          tracks: {
            tempering: {
              vitality: { level: 0, progress: 0 },
              spirit: { level: 0, progress: 0 },
              wisdom: { level: 0, progress: 0 },
              speed: { level: 0, progress: 0 },
              willpower: { level: 0, progress: 0 },
            },
            marrowWash: { level: 0, progress: 0 },
          },
          counters: {
            longTermPillUsesByRealm: {},
          },
          statuses: [
            {
              key: 'minor_wound',
              stacks: 1,
              source: 'battle',
              duration: { kind: 'until_removed' },
              createdAt: '2026-05-16T00:00:00.000Z',
              updatedAt: '2026-05-16T00:00:00.000Z',
            },
          ],
          timestamps: {},
        },
      } as never,
      finalAttributes: {
        final: {} as never,
        maxHp: 480,
        maxMp: 220,
      },
      unreadMailCount: 3,
      now: new Date('2026-05-16T00:00:00.000Z'),
    });

    expect(snapshot?.name).toBe('林玄');
    expect(snapshot?.spiritStones).toBe(1280);
    expect(snapshot?.unreadMailCount).toBe(3);
    expect(snapshot?.statusText).toContain('轻伤');
    expect(snapshot?.statusText).toContain('丹毒轻染');
    expect(snapshot?.metrics).toEqual([
      {
        key: 'hp',
        label: 'HP',
        display: '312/480',
        percent: 65,
        tone: 'hp',
      },
      {
        key: 'mp',
        label: 'MP',
        display: '85/220',
        percent: 39,
        tone: 'mp',
      },
      {
        key: 'cultivation',
        label: '修为',
        display: '72%',
        percent: 72,
        tone: 'progress',
      },
      {
        key: 'insight',
        label: '感悟',
        display: '41/100',
        percent: 41,
        tone: 'insight',
      },
    ]);
  });
});
