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
      percent: 80,
      insight: 45,
      bottleneckState: true,
      innerDemon: false,
      deviationRisk: 18,
      breakthroughFailures: 2,
    });
  });
});
