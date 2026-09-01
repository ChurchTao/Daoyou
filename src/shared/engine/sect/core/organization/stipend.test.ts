import { REALM_VALUES } from '@shared/types/constants';
import { describe, expect, it } from 'vitest';
import {
  calculateStandardSectStipendBase,
  STANDARD_SECT_STIPEND_CURVE,
} from './stipend';
import { calculateRealmSectTaskReward } from './taskRewards';

describe('sect stipend', () => {
  it('uses realm-scaled weekly value and rank multipliers', () => {
    expect(STANDARD_SECT_STIPEND_CURVE).toEqual({
      realmDailyBudgetMultiplier: 2,
      rankMultiplierBps: {
        registered: 7_500,
        outer: 10_000,
        inner: 12_500,
        true: 15_000,
      },
      roundUnit: 100,
    });
    expect(calculateStandardSectStipendBase('registered', '炼气')).toBe(1_500);
    expect(calculateStandardSectStipendBase('outer', '金丹')).toBe(6_400);
    expect(calculateStandardSectStipendBase('inner', '化神')).toBe(22_500);
    expect(calculateStandardSectStipendBase('true', '渡劫')).toBe(126_000);
  });

  it('keeps an outer-disciple stipend above one normal daily task', () => {
    for (const realm of REALM_VALUES) {
      const dailyTask = calculateRealmSectTaskReward({
        realm,
        realmStage: '初期',
        difficulty: 'normal',
        cadence: 'daily',
        reward: { baseContribution: 40 },
      });
      const stipend = calculateStandardSectStipendBase('outer', realm);
      expect(stipend).toBeGreaterThan(dailyTask.spiritStones);
      expect(stipend % STANDARD_SECT_STIPEND_CURVE.roundUnit).toBe(0);
    }
  });
});
