import { REALM_VALUES } from '@shared/types/constants';
import { describe, expect, it } from 'vitest';
import {
  calculateTravelStoryReward,
  chooseActivityStoryDirectorDecision,
  combineStoryDangerAdjustments,
  isActivityStoryOwnedByCultivator,
  isActivityStoryRewardWithinBudget,
  shouldGenerateTravelStoryEvent,
  shouldReplaceActivityStoryDecision,
  TravelStoryIntentPayloadSchema,
  travelStoryMainlineDangerAdjustment,
} from './travelStory';

describe('travel story rules', () => {
  it('requires enough travel time and no unresolved encounter', () => {
    const base = {
      actionInstanceId: '2f3f9b32-f5f1-4ad6-bfbb-c607ad79a703',
      chance: 1,
      now: new Date('2026-08-25T08:00:00.000Z'),
    };

    expect(
      shouldGenerateTravelStoryEvent({
        ...base,
        hours: 3,
        hasPendingEvent: false,
      }),
    ).toBe(false);
    expect(
      shouldGenerateTravelStoryEvent({
        ...base,
        hours: 4,
        hasPendingEvent: true,
      }),
    ).toBe(false);
    expect(
      shouldGenerateTravelStoryEvent({
        ...base,
        hours: 4,
        hasPendingEvent: false,
      }),
    ).toBe(true);
  });

  it('respects cooldown and guarantees a long journey encounter', () => {
    const now = new Date('2026-08-25T08:00:00.000Z');
    expect(
      shouldGenerateTravelStoryEvent({
        actionInstanceId: '71b882bd-9618-403e-9723-109901c90592',
        hours: 20,
        hasPendingEvent: false,
        lastEventAt: new Date('2026-08-25T00:01:00.000Z'),
        now,
        chance: 0,
      }),
    ).toBe(false);
    expect(
      shouldGenerateTravelStoryEvent({
        actionInstanceId: '71b882bd-9618-403e-9723-109901c90592',
        hours: 20,
        hasPendingEvent: false,
        lastEventAt: new Date('2026-08-24T19:59:00.000Z'),
        now,
        chance: 0,
      }),
    ).toBe(true);
  });

  it('scales deterministic rewards by realm, stage and journey duration', () => {
    const shortReward = calculateTravelStoryReward({
      realm: '炼气',
      realmStage: '初期',
      hours: 4,
      rewardKind: 'cultivation_exp',
    });
    const longReward = calculateTravelStoryReward({
      realm: '筑基',
      realmStage: '后期',
      hours: 20,
      rewardKind: 'cultivation_exp',
    });

    expect(shortReward.value).toBeGreaterThan(0);
    expect(longReward.value).toBeGreaterThan(shortReward.value);
    expect(
      calculateTravelStoryReward({
        realm: '炼气',
        realmStage: '初期',
        hours: 4,
        rewardKind: 'spirit_stones',
      }),
    ).toEqual(
      calculateTravelStoryReward({
        realm: '炼气',
        realmStage: '初期',
        hours: 4,
        rewardKind: 'spirit_stones',
      }),
    );
  });

  it('turns mainline travel choices into bounded dungeon danger changes', () => {
    expect(travelStoryMainlineDangerAdjustment('approach_carefully')).toBe(-5);
    expect(travelStoryMainlineDangerAdjustment('act_decisively')).toBe(5);
    expect(combineStoryDangerAdjustments(10, 5)).toBe(10);
    expect(combineStoryDangerAdjustments(-5, -5)).toBe(-10);
  });

  it('selects one highest-priority story decision per root activity', () => {
    expect(
      chooseActivityStoryDirectorDecision([
        'dungeon_short',
        'sect_task_short',
        'mainline_dungeon',
      ]),
    ).toBe('mainline_dungeon');
    expect(
      shouldReplaceActivityStoryDecision({
        current: 'dungeon_short',
        candidate: 'sect_task_short',
      }),
    ).toBe(true);
    expect(
      shouldReplaceActivityStoryDecision({
        current: 'dungeon_short',
        candidate: 'mainline_dungeon',
        currentResolved: true,
      }),
    ).toBe(false);
  });

  it('enforces activity reward budgets and cultivator ownership', () => {
    const reward = calculateTravelStoryReward({
      realm: '炼气',
      realmStage: '初期',
      hours: 4,
      rewardKind: 'spirit_stones',
      activityType: 'sect_task',
    });
    expect(
      isActivityStoryRewardWithinBudget({
        realm: '炼气',
        realmStage: '初期',
        hours: 4,
        activityType: 'sect_task',
        reward,
      }),
    ).toBe(true);
    expect(
      isActivityStoryRewardWithinBudget({
        realm: '炼气',
        realmStage: '初期',
        hours: 4,
        activityType: 'sect_task',
        reward: { ...reward, value: reward.value + 1 },
      }),
    ).toBe(false);
    expect(
      isActivityStoryOwnedByCultivator({
        ownerCultivatorId: 'cultivator-a',
        requestedCultivatorId: 'cultivator-b',
      }),
    ).toBe(false);
  });

  it('applies the deterministic activity budget at every cultivation realm', () => {
    for (const realm of REALM_VALUES) {
      for (const activityType of ['travel', 'sect_task', 'dungeon'] as const) {
        const reward = calculateTravelStoryReward({
          realm,
          realmStage: '圆满',
          hours: 8,
          rewardKind: 'cultivation_exp',
          activityType,
        });
        expect(reward.value).toBeGreaterThan(0);
        expect(
          isActivityStoryRewardWithinBudget({
            realm,
            realmStage: '圆满',
            hours: 8,
            activityType,
            reward,
          }),
        ).toBe(true);
      }
    }
  });

  it('keeps a travel anomaly pending while its linked dungeon runs', () => {
    const parsed = TravelStoryIntentPayloadSchema.parse({
      kind: 'activity_story',
      eventType: 'wild_omen',
      title: '山道旧痕',
      content:
        '归途山壁露出一道与旧日记忆相连的刻痕，痕迹指向山腹深处尚未查明的异动。',
      memoryRefs: [],
      entityRefs: [],
      continuityClaims: [],
      choices: [
        {
          key: 'approach_carefully',
          label: '审痕记路',
          description: '先核对旧痕再寻找安全入口。',
          outcome: '你核对旧痕后找到一条通向山腹的安全入口，源头仍待深入查明。',
          memorySummary: '玩家谨慎辨认旧痕并找到关联秘境入口。',
          tags: ['云游', '谨慎'],
          rewardKind: 'comprehension_insight',
        },
        {
          key: 'act_decisively',
          label: '破门追痕',
          description: '趁痕迹未散直接破开旧门。',
          outcome: '你破开旧门追入山腹，异响从更深处传来，真相仍待探索。',
          memorySummary: '玩家果断破门并找到关联秘境入口。',
          tags: ['云游', '果断'],
          rewardKind: 'cultivation_exp',
        },
      ],
      source: {
        actionInstanceId: '00000000-0000-4000-8000-000000000001',
        hours: 8,
        realm: '炼气',
        realmStage: '初期',
        activityType: 'travel',
      },
      selectedChoiceKey: 'approach_carefully',
      selectedOutcome:
        '你核对旧痕后找到一条通向山腹的安全入口，源头仍待深入查明。',
      linkedDungeon: {
        status: 'running',
        mapNodeId: 'SAT_TN_01',
        runId: '00000000-0000-4000-8000-000000000002',
        blueprint: {
          title: '山痕暗径',
          theme: '旧日刻痕在山腹暗径中继续延伸，并与玩家已有记忆相互呼应。',
          objective: '查明刻痕源头并处理阻路威胁。',
          openingHook: '玩家从安全侧缝进入山腹，刻痕在黑暗中逐段显露。',
          primaryClue: '山腹深处的新刻痕',
          dangerTone: 'cautious',
        },
      },
    });

    expect(parsed.linkedDungeon).toMatchObject({
      status: 'running',
      mapNodeId: 'SAT_TN_01',
    });
    expect(parsed.selectedReward).toBeUndefined();
  });
});
