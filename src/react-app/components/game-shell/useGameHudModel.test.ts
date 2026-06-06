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
});
