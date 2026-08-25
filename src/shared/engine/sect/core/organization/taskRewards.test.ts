import { REALM_VALUES } from '@shared/types/constants';
import { describe, expect, it } from 'vitest';
import {
  STANDARD_SECT_TASK_BASE_CONTRIBUTION,
  StandardSectOrganizationModule,
} from './StandardSectOrganizationModule';
import {
  SECT_TASK_DIFFICULTY_MULTIPLIER_BPS,
  STANDARD_SECT_TASK_REWARD_CURVE,
  calculateRealmSectTaskReward,
  resolveSectTaskDifficulty,
} from './taskRewards';

describe('sect task rewards', () => {
  it('uses the standard cultivation and contribution curve', () => {
    expect(STANDARD_SECT_TASK_REWARD_CURVE).toMatchObject({
      cultivationFraction: {
        easy: 0.05,
        normal: 0.08,
        hard: 0.12,
        elite: 0.18,
      },
      cadenceMultiplier: { daily: 1, weekly: 3 },
      spiritStoneMultiplier: 5,
      spiritStoneRoundUnit: 100,
    });
    expect(Object.values(SECT_TASK_DIFFICULTY_MULTIPLIER_BPS)).toEqual([
      10_000, 11_500, 13_500, 16_000,
    ]);
  });

  it.each([
    ['daily', 'easy', 160, 3_000, 40],
    ['daily', 'normal', 256, 3_500, 46],
    ['daily', 'hard', 384, 4_100, 54],
    ['daily', 'elite', 576, 4_800, 64],
    ['weekly', 'easy', 480, 9_000, 40],
    ['weekly', 'normal', 768, 10_400, 46],
    ['weekly', 'hard', 1_152, 12_200, 54],
    ['weekly', 'elite', 1_728, 14_400, 64],
  ] as const)(
    'calculates 金丹 %s %s rewards',
    (cadence, difficulty, cultivationExp, spiritStones, contribution) => {
      expect(
        calculateRealmSectTaskReward({
          realm: '金丹',
          realmStage: '初期',
          difficulty,
          cadence,
          reward: { baseContribution: 40 },
        }),
      ).toMatchObject({
        policyVersion: 3,
        difficulty,
        cultivationExp,
        spiritStones,
        contribution,
      });
    },
  );

  it('applies the weekly cadence before deriving the spirit-stone reward', () => {
    expect(
      calculateRealmSectTaskReward({
        realm: '渡劫',
        realmStage: '圆满',
        difficulty: 'elite',
        cadence: 'weekly',
        reward: { baseContribution: 60 },
      }),
    ).toMatchObject({
      cultivationExp: 22_680,
      spiritStones: 113_400,
      contribution: 96,
    });
  });

  it('keeps the realm floor while guaranteeing at least five stones per exp', () => {
    for (const realm of REALM_VALUES) {
      for (const difficulty of ['easy', 'normal', 'hard', 'elite'] as const) {
        const reward = calculateRealmSectTaskReward({
          realm,
          realmStage: '中期',
          difficulty,
          cadence: 'daily',
          reward: { baseContribution: 30 },
        });
        expect(reward.spiritStones).toBeGreaterThanOrEqual(
          reward.cultivationExp * 5,
        );
        expect(reward.spiritStones % 100).toBe(0);
      }
    }
    expect(
      calculateRealmSectTaskReward({
        realm: '炼气',
        realmStage: '初期',
        difficulty: 'easy',
        cadence: 'daily',
        reward: { baseContribution: 30 },
      }).spiritStones,
    ).toBe(1_000);
    expect(
      calculateRealmSectTaskReward({
        realm: '渡劫',
        realmStage: '初期',
        difficulty: 'easy',
        cadence: 'daily',
        reward: { baseContribution: 30 },
      }).spiritStones,
    ).toBe(10_500);
  });

  it('uses the higher of the configured and generated difficulty', () => {
    expect(resolveSectTaskDifficulty('easy', 'elite')).toBe('elite');
    expect(resolveSectTaskDifficulty('hard', 'normal')).toBe('hard');
    expect(resolveSectTaskDifficulty(undefined, 'normal')).toBe('normal');
  });

  it('keeps a fully unlocked week near 300 contribution', () => {
    const taskContribution = (
      taskId: keyof typeof STANDARD_SECT_TASK_BASE_CONTRIBUTION,
      difficulty: 'easy' | 'normal' | 'hard' | 'elite',
      cadence: 'daily' | 'weekly',
    ) =>
      calculateRealmSectTaskReward({
        realm: '金丹',
        realmStage: '初期',
        difficulty,
        cadence,
        reward: {
          baseContribution: STANDARD_SECT_TASK_BASE_CONTRIBUTION[taskId],
        },
      }).contribution;
    const minimumDaily =
      taskContribution('dungeon_exploration', 'normal', 'daily') +
      taskContribution('mine_patrol', 'normal', 'daily') +
      taskContribution('pill_delivery', 'easy', 'daily') +
      taskContribution('artifact_delivery', 'easy', 'daily');
    const maximumDaily =
      taskContribution('dungeon_exploration', 'normal', 'daily') +
      taskContribution('mine_patrol', 'normal', 'daily') +
      taskContribution('pill_delivery', 'elite', 'daily') +
      taskContribution('artifact_delivery', 'elite', 'daily');
    const minimumWeekly =
      taskContribution('weekly_diligence', 'easy', 'weekly') +
      taskContribution('weekly_tournament', 'hard', 'weekly') +
      taskContribution('weekly_bounty_battle', 'hard', 'weekly') +
      taskContribution('weekly_bounty_material', 'hard', 'weekly');
    const maximumWeekly =
      taskContribution('weekly_diligence', 'easy', 'weekly') +
      taskContribution('weekly_tournament', 'hard', 'weekly') +
      taskContribution('weekly_bounty_battle', 'hard', 'weekly') +
      taskContribution('weekly_bounty_material', 'elite', 'weekly');

    expect(minimumDaily * 7 + minimumWeekly).toBe(265);
    expect(maximumDaily * 7 + maximumWeekly).toBe(305);
  });

  it('declares the standard task difficulty floors', () => {
    const tasks = new StandardSectOrganizationModule().tasks;
    expect(tasks.get('dungeon_exploration')?.minimumDifficulty).toBe(
      'normal',
    );
    expect(tasks.get('dungeon_exploration')?.executorKey).toBe('sect.dungeon');
    expect(tasks.get('mine_patrol')?.minimumDifficulty).toBe('normal');
    expect(tasks.get('gate_sweep')).toBeUndefined();
    expect(tasks.get('spirit_mining')).toBeUndefined();
    expect(tasks.get('pill_delivery')?.minimumDifficulty).toBe('easy');
    expect(tasks.get('artifact_delivery')?.minimumDifficulty).toBe('easy');
    expect(tasks.get('weekly_diligence')?.minimumDifficulty).toBe('easy');
    expect(tasks.get('weekly_tournament')?.minimumDifficulty).toBe('hard');
    expect(tasks.get('weekly_bounty_battle')?.minimumDifficulty).toBe('hard');
    expect(tasks.get('weekly_bounty_material')?.minimumDifficulty).toBe('hard');
    expect(tasks.get('elder_trial')?.reward).toBeUndefined();
  });
});
