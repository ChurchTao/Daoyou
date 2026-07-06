import { describe, expect, it } from 'vitest';
import { buildGameHudSnapshot } from './useGameHudModel';

describe('buildGameHudSnapshot', () => {
  it('includes the cultivator id for HUD side-channel state', () => {
    const snapshot = buildGameHudSnapshot({
      cultivator: {
        id: 'cultivator-1',
        name: '韩立',
        title: null,
        realm: '筑基',
        realm_stage: '初期',
        spirit_stones: 12345,
        cultivation_progress: {
          cultivation_exp: 80,
          exp_cap: 100,
          comprehension_insight: 30,
        },
        condition: {
          gauges: {
            pillToxicity: 0,
          },
          statuses: [],
        },
      } as any,
      display: {
        resources: {
          hp: { current: 80, max: 100, percent: 80 },
          mp: { current: 60, max: 100, percent: 60 },
        },
      } as any,
      unreadMailCount: 0,
    });

    expect(snapshot?.cultivatorId).toBe('cultivator-1');
    expect(snapshot?.realm).toBe('筑基');
    expect(snapshot?.realmStage).toBe('初期');
    expect(snapshot?.hasUnallocatedAttributePoints).toBe(false);
  });

  it('flags unallocated attribute points for dock reminders', () => {
    const snapshot = buildGameHudSnapshot({
      cultivator: {
        id: 'cultivator-1',
        name: '韩立',
        title: null,
        realm: '筑基',
        realm_stage: '初期',
        spirit_stones: 12345,
        unallocated_attribute_points: 1,
        cultivation_progress: {
          cultivation_exp: 80,
          exp_cap: 100,
          comprehension_insight: 30,
        },
        condition: {
          gauges: {
            pillToxicity: 0,
          },
          statuses: [],
        },
      } as any,
      display: {
        resources: {
          hp: { current: 80, max: 100, percent: 80 },
          mp: { current: 60, max: 100, percent: 60 },
        },
      } as any,
      unreadMailCount: 0,
    });

    expect(snapshot?.hasUnallocatedAttributePoints).toBe(true);
  });

  it('formats large hp and mp values with wan units', () => {
    const snapshot = buildGameHudSnapshot({
      cultivator: {
        id: 'cultivator-1',
        name: '韩立',
        title: null,
        realm: '筑基',
        realm_stage: '初期',
        spirit_stones: 12345,
        cultivation_progress: {
          cultivation_exp: 80,
          exp_cap: 100,
          comprehension_insight: 30,
        },
        condition: {
          gauges: {
            pillToxicity: 0,
          },
          statuses: [],
        },
      } as any,
      display: {
        resources: {
          hp: { current: 12345, max: 20000, percent: 62 },
          mp: { current: 9999, max: 10000, percent: 99 },
        },
      } as any,
      unreadMailCount: 0,
    });

    expect(
      snapshot?.metrics.find((metric) => metric.key === 'hp')?.display,
    ).toBe('1.23万/2万');
    expect(
      snapshot?.metrics.find((metric) => metric.key === 'mp')?.display,
    ).toBe('9999/1万');
  });

  it('includes detailed cultivation progress for the HUD dialog', () => {
    const snapshot = buildGameHudSnapshot({
      cultivator: {
        id: 'cultivator-1',
        name: '韩立',
        title: null,
        realm: '筑基',
        realm_stage: '初期',
        spirit_stones: 12345,
        cultivation_progress: {
          cultivation_exp: 240,
          exp_cap: 300,
          comprehension_insight: 45,
          breakthrough_failures: 2,
          bottleneck_state: true,
          inner_demon: false,
          deviation_risk: 18,
        },
        condition: {
          gauges: {
            pillToxicity: 0,
          },
          statuses: [],
        },
      } as any,
      display: {
        resources: {
          hp: { current: 80, max: 100, percent: 80 },
          mp: { current: 60, max: 100, percent: 60 },
        },
      } as any,
      unreadMailCount: 0,
    });

    expect(snapshot?.cultivationProgress).toEqual({
      current: 240,
      cap: 300,
      remaining: 60,
      overflow: 0,
      percent: 80,
      insight: 45,
      bottleneckState: true,
      innerDemon: false,
      deviationRisk: 18,
      breakthroughFailures: 2,
    });
  });

  it('surfaces overflow cultivation progress in the HUD model', () => {
    const snapshot = buildGameHudSnapshot({
      cultivator: {
        id: 'cultivator-1',
        name: '韩立',
        title: null,
        realm: '筑基',
        realm_stage: '初期',
        spirit_stones: 12345,
        cultivation_progress: {
          cultivation_exp: 360,
          exp_cap: 300,
          comprehension_insight: 45,
        },
        condition: {
          gauges: {
            pillToxicity: 0,
          },
          statuses: [],
        },
      } as any,
      display: {
        resources: {
          hp: { current: 80, max: 100, percent: 80 },
          mp: { current: 60, max: 100, percent: 60 },
        },
      } as any,
      unreadMailCount: 0,
    });

    expect(snapshot?.cultivationProgress).toMatchObject({
      current: 360,
      cap: 300,
      remaining: 0,
      overflow: 60,
      percent: 120,
    });
    expect(
      snapshot?.metrics.find((metric) => metric.key === 'cultivation')?.display,
    ).toBe('360/300');
  });

  it('includes body cultivation summary for the HUD body tag', () => {
    const snapshot = buildGameHudSnapshot({
      cultivator: {
        id: 'cultivator-1',
        name: '韩立',
        title: null,
        realm: '筑基',
        realm_stage: '初期',
        spirit_stones: 12345,
        cultivation_progress: {
          cultivation_exp: 80,
          exp_cap: 100,
          comprehension_insight: 30,
        },
        condition: {
          gauges: {
            pillToxicity: 0,
          },
          statuses: [],
          tracks: {
            bodyCultivation: {
              version: 1,
              realm: 'bronze_skin',
              tracks: {
                skin: { level: 3, progress: 10 },
                sinew_bone: { level: 2, progress: 20 },
                organs: { level: 1, progress: 30 },
                qi_blood: { level: 4, progress: 40 },
                primordial_spirit: { level: 0, progress: 0 },
              },
              milestones: {},
            },
            marrowWash: {
              version: 1,
              level: 10,
              progress: 35,
              realm: 0,
              breakthroughs: 0,
            },
          },
        },
      } as any,
      display: {
        resources: {
          hp: { current: 80, max: 100, percent: 80 },
          mp: { current: 60, max: 100, percent: 60 },
        },
      } as any,
      unreadMailCount: 0,
    });

    expect(snapshot?.bodyCultivation.realm.label).toBe('铜皮');
    expect(snapshot?.bodyCultivation.totalLevel).toBe(10);
    expect(snapshot?.bodyCultivation.tracks).toHaveLength(5);
    expect(snapshot?.bodyCultivation.tracks[0]).toMatchObject({
      key: 'skin',
      level: 3,
    });
    expect(snapshot?.marrowWash).toMatchObject({
      level: 10,
      progress: 35,
      levelCap: 20,
      canBreakthrough: true,
    });
  });

  it('includes active status details for the HUD status dialog', () => {
    const snapshot = buildGameHudSnapshot({
      cultivator: {
        id: 'cultivator-1',
        name: '韩立',
        title: null,
        realm: '筑基',
        realm_stage: '初期',
        spirit_stones: 12345,
        cultivation_progress: {
          cultivation_exp: 80,
          exp_cap: 100,
          comprehension_insight: 30,
        },
        condition: {
          gauges: {
            pillToxicity: 0,
          },
          statuses: [
            {
              key: 'cultivation_boost',
              stacks: 1,
              source: 'pill',
              duration: { kind: 'until_removed' },
              usesRemaining: 1,
              payload: {
                boostPercent: 0.5,
                retreatExpMultiplier: 1.5,
              },
              createdAt: '2026-06-01T00:00:00.000Z',
              updatedAt: '2026-06-01T00:00:00.000Z',
            },
          ],
        },
      } as any,
      display: {
        resources: {
          hp: { current: 80, max: 100, percent: 80 },
          mp: { current: 60, max: 100, percent: 60 },
        },
      } as any,
      unreadMailCount: 0,
    });

    expect(snapshot?.statusText).toBe('养元');
    expect(snapshot?.activeStatuses).toHaveLength(1);
    expect(snapshot?.activeStatuses[0]).toMatchObject({
      key: 'cultivation_boost',
      label: '养元',
      category: 'pill',
      usesRemaining: 1,
    });
    expect(snapshot?.activeStatuses[0].details.join('\n')).toContain(
      '下次闭关修为 +50%',
    );
  });

  it('includes pill toxicity details even when no status instance is active', () => {
    const snapshot = buildGameHudSnapshot({
      cultivator: {
        id: 'cultivator-1',
        name: '韩立',
        title: null,
        realm: '筑基',
        realm_stage: '初期',
        spirit_stones: 12345,
        cultivation_progress: {
          cultivation_exp: 80,
          exp_cap: 100,
          comprehension_insight: 30,
        },
        condition: {
          gauges: {
            pillToxicity: 450,
          },
          statuses: [],
        },
      } as any,
      display: {
        resources: {
          hp: { current: 80, max: 100, percent: 80 },
          mp: { current: 60, max: 100, percent: 60 },
        },
      } as any,
      unreadMailCount: 0,
    });

    expect(snapshot?.statusText).toBe('丹毒郁结');
    expect(snapshot?.activeStatuses).toHaveLength(0);
    expect(snapshot?.pillToxicity).toMatchObject({
      active: true,
      label: '丹毒郁结',
      value: 450,
    });
    expect(snapshot?.pillToxicity.details.join('\n')).toContain(
      '当前丹毒值为 450',
    );
  });

  it('keeps a stable calm status when there are no active statuses', () => {
    const snapshot = buildGameHudSnapshot({
      cultivator: {
        id: 'cultivator-1',
        name: '韩立',
        title: null,
        realm: '筑基',
        realm_stage: '初期',
        spirit_stones: 12345,
        cultivation_progress: {
          cultivation_exp: 80,
          exp_cap: 100,
          comprehension_insight: 30,
        },
        condition: {
          gauges: {
            pillToxicity: 0,
          },
          statuses: [],
        },
      } as any,
      display: {
        resources: {
          hp: { current: 80, max: 100, percent: 80 },
          mp: { current: 60, max: 100, percent: 60 },
        },
      } as any,
      unreadMailCount: 0,
    });

    expect(snapshot?.statusText).toBe('安稳');
    expect(snapshot?.activeStatuses).toEqual([]);
    expect(snapshot?.pillToxicity.active).toBe(false);
  });
});
