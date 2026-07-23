import type { SectTasksData, SectTaskViewData } from '@shared/contracts/sect';
import { describe, expect, it } from 'vitest';
import {
  resolveSweepActivityMode,
  sweepActivityMessage,
} from './sweepActivityState';

function tasksWith(
  state: SectTaskViewData['state'],
): SectTasksData {
  return {
    dateKey: '2026-07-23',
    weekKey: '2026-W30',
    sections: {
      daily: [
        {
          id: 'record',
          definitionId: 'gate_sweep',
          kind: 'daily',
          state,
          periodKey: '2026-07-23',
          progress: { current: state === 'completed' ? 1 : 0, target: 1 },
          presentation: {
            title: '清扫山门',
            description: '清理山门步道。',
            contributionReward: 25,
            rewardSummary: '25 宗门贡献',
          },
          actions: [],
        },
      ],
      weekly: [],
      promotion: [],
    },
  };
}

describe('sweep activity mode', () => {
  it('uses reward mode only for an accepted active sweep task', () => {
    expect(resolveSweepActivityMode(tasksWith('active'))).toMatchObject({
      kind: 'reward',
      task: { definitionId: 'gate_sweep' },
    });
  });

  it('keeps offered, completed and locked tasks playable as practice', () => {
    expect(resolveSweepActivityMode(tasksWith('offered'))).toMatchObject({
      kind: 'practice',
      reason: 'not_accepted',
    });
    expect(resolveSweepActivityMode(tasksWith('completed'))).toMatchObject({
      kind: 'practice',
      reason: 'completed',
    });
    expect(resolveSweepActivityMode(tasksWith('locked'))).toMatchObject({
      kind: 'practice',
      reason: 'other_daily',
    });
  });

  it('makes the no-reward boundary explicit', () => {
    const mode = resolveSweepActivityMode(tasksWith('completed'));
    expect(sweepActivityMessage(mode)).toContain('自由练习');
    expect(sweepActivityMessage(mode)).toContain('不再获得奖励');
  });
});
