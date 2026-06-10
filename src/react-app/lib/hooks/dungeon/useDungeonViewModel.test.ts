import { describe, expect, it } from 'vitest';
import type { DungeonState } from '@shared/lib/dungeon/types';
import {
  resolveDungeonMutationResult,
  shouldRefreshCultivatorAfterDungeonMutation,
} from './useDungeonViewModel';

describe('resolveDungeonMutationResult', () => {
  it('prioritizes finished settlement over state payloads', () => {
    const state = { status: 'LOOTING' } as DungeonState;
    const settlement = {
      ending_narrative: '秘境结算完成。',
      settlement: {
        reward_tier: 'C' as const,
        reward_blueprints: [
          {
            name: '青木灵草',
            description: '一株带着青木灵气的草药。',
          },
        ],
        performance_tags: ['稳妥收获'],
      },
    };

    expect(
      resolveDungeonMutationResult({
        isFinished: true,
        state,
        settlement,
        realGains: [],
      }),
    ).toEqual({
      type: 'settlement',
      settlement,
      realGains: [],
    });
  });

  it('turns conflict responses into a refresh instruction', () => {
    expect(resolveDungeonMutationResult({ conflict: true })).toEqual({
      type: 'refresh',
    });
  });

  it('keeps state updates and clear results distinct', () => {
    const state = { status: 'EXPLORING' } as DungeonState;

    expect(resolveDungeonMutationResult({ state })).toEqual({
      type: 'state',
      state,
    });
    expect(resolveDungeonMutationResult({ success: true })).toEqual({
      type: 'clear',
    });
  });
});

describe('shouldRefreshCultivatorAfterDungeonMutation', () => {
  it('does not manually refresh cultivator data after event-driven mutations', () => {
    expect(
      shouldRefreshCultivatorAfterDungeonMutation({
        type: 'state',
        state: { status: 'EXPLORING' } as DungeonState,
      }),
    ).toBe(false);
    expect(
      shouldRefreshCultivatorAfterDungeonMutation({
        type: 'settlement',
        settlement: undefined,
        realGains: [],
      }),
    ).toBe(false);
    expect(
      shouldRefreshCultivatorAfterDungeonMutation({ type: 'clear' }),
    ).toBe(false);
  });

  it('does not refresh cultivator data for local-only refresh or empty results', () => {
    expect(
      shouldRefreshCultivatorAfterDungeonMutation({ type: 'refresh' }),
    ).toBe(false);
    expect(shouldRefreshCultivatorAfterDungeonMutation({ type: 'none' })).toBe(
      false,
    );
  });
});
