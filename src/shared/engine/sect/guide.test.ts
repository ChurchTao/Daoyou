import { getRealmStageRank } from '@shared/config/realmProgression';
import { REALM_STAGE_VALUES, REALM_VALUES } from '@shared/types/constants';
import { describe, expect, it } from 'vitest';
import {
  SWIFT_MERIDIAN_STAGES,
  assignAbilityToSlot,
  clearAbilitySlot,
  createAbilitySlots,
  fillFirstEmptyAbilitySlots,
  getSwiftMeridianProgress,
  projectLingxiaoAbilityDetail,
  resolveMethodMilestones,
  validateAbilitySlots,
} from './guide';
import type { CultivatorSectState } from './types';

function state(overrides: Partial<CultivatorSectState> = {}): CultivatorSectState {
  return {
    membershipId: 'member-1',
    sectId: 'lingxiao',
    status: 'active',
    contribution: 30,
    tacticId: 'steady',
    activeMeridianSlot: 1,
    configVersion: 1,
    methods: { 'lingxiao-canon': 5, 'sword-guidance': 5 },
    meridianLoadouts: [{ slot: 1, nodeIds: [], version: 1 }],
    abilityLoadout: ['guiding-sword', null, null, null],
    ...overrides,
  };
}

describe('凌霄心法引导', () => {
  it('标记已解锁、下一节点和后续节点', () => {
    const nodes = resolveMethodMilestones({
      methodId: 'sword-guidance', sect: state(), realm: '炼气', stage: '初期',
    });
    expect(nodes.map((node) => [node.name, node.status])).toEqual([
      ['平剑式', 'unlocked'],
      ['引剑式', 'unlocked'],
      ['连锋式', 'next'],
    ]);
  });

  it('明确主心法联合前置与快剑道限制', () => {
    const sect = state({
      pathId: undefined,
      methods: { 'lingxiao-canon': 70, 'swift-sword-canon': 69 },
    });
    const instant = resolveMethodMilestones({
      methodId: 'lingxiao-canon', sect, realm: '化神', stage: '初期',
    }).find((node) => node.id === 'lingxiao-instant')!;
    expect(instant.status).toBe('locked');
    expect(instant.missingRequirements).toContain('选择快剑道');
    expect(instant.missingRequirements).toContain('《疾风剑典》70级');
  });
});

describe('快剑剑脉开放进度', () => {
  it('覆盖九境四阶段并按六个门槛开放', () => {
    for (const realm of REALM_VALUES) {
      for (const stage of REALM_STAGE_VALUES) {
        const progress = getSwiftMeridianProgress({ realm, stage, methods: {} });
        const currentRank = getRealmStageRank(realm, stage);
        const expectedOrdinary = SWIFT_MERIDIAN_STAGES.filter(
          (item) => item.layer !== 'ultimate' && currentRank >= getRealmStageRank(item.realm, item.stage),
        ).length;
        expect(progress.ordinaryOpenLayers).toHaveLength(expectedOrdinary);
        expect(progress.ultimateAvailable).toBe(false);
      }
    }
  });

  it('区分终式境界门槛与两卷心法门槛', () => {
    const lackingMethods = getSwiftMeridianProgress({
      realm: '化神', stage: '圆满', methods: { 'lingxiao-canon': 100, 'swift-sword-canon': 99 },
    });
    expect(lackingMethods.ultimateRealmMet).toBe(true);
    expect(lackingMethods.ultimateMissingMethods).toEqual(['swift-sword-canon']);
    expect(lackingMethods.ultimateAvailable).toBe(false);

    expect(getSwiftMeridianProgress({
      realm: '化神', stage: '圆满', methods: { 'lingxiao-canon': 100, 'swift-sword-canon': 100 },
    }).ultimateAvailable).toBe(true);
  });
});

describe('宗门神通详情与四槽配置', () => {
  it('按当前境界与激活剑脉投影神通数值', () => {
    const detail = projectLingxiaoAbilityDetail({
      abilityId: 'linked-edge',
      realm: '筑基',
      sect: state({
        pathId: 'swift-sword',
        methods: { 'lingxiao-canon': 100, 'sword-guidance': 100, 'swift-sword-canon': 100 },
        meridianLoadouts: [{ slot: 1, nodeIds: ['swift-split-light'], version: 1 }],
      }),
    });
    expect(detail.name).toBe('流光三叠');
    expect(detail.manaCost).toBe(18);
    expect(detail.effect).toMatchObject({ hits: 5, momentumGain: 3 });
    expect(detail.totalDamageCoefficient).toBeCloseTo(1.458);
  });

  it('支持替换、交换、固定空槽且不产生重复神通', () => {
    const initial = createAbilitySlots(['guiding-sword', 'linked-edge']);
    expect(assignAbilityToSlot(initial, 0, 'linked-edge')).toEqual([
      'linked-edge', 'guiding-sword', null, null,
    ]);
    expect(assignAbilityToSlot(initial, 0, 'turning-body')).toEqual([
      'turning-body', 'linked-edge', null, null,
    ]);
    expect(clearAbilitySlot(initial, 0)).toEqual([null, 'linked-edge', null, null]);
    expect(clearAbilitySlot(['guiding-sword', 'linked-edge', null, 'turning-body'], 2)).toEqual([
      'guiding-sword', 'linked-edge', null, 'turning-body',
    ]);
    expect(assignAbilityToSlot(['guiding-sword', null, 'turning-body', null], 1, 'turning-body')).toEqual([
      'guiding-sword', 'turning-body', null, null,
    ]);
  });

  it('无论已解锁数量均允许保留空槽', () => {
    const slots = createAbilitySlots(['guiding-sword', 'linked-edge']);
    expect(validateAbilitySlots({
      slots, unlockedActiveAbilityIds: ['guiding-sword', 'linked-edge'],
    }).valid).toBe(true);
    expect(validateAbilitySlots({
      slots,
      unlockedActiveAbilityIds: ['guiding-sword', 'linked-edge', 'turning-body', 'breaking-edge'],
    }).valid).toBe(true);
  });

  it('拒绝重复与未解锁神通，并只向第一个空槽补入新解锁神通', () => {
    expect(validateAbilitySlots({
      slots: ['guiding-sword', null, 'guiding-sword', null],
      unlockedActiveAbilityIds: ['guiding-sword'],
    }).valid).toBe(false);
    expect(validateAbilitySlots({
      slots: ['turning-body', null, null, null],
      unlockedActiveAbilityIds: ['guiding-sword'],
    }).valid).toBe(false);
    expect(fillFirstEmptyAbilitySlots(
      ['guiding-sword', null, 'turning-body', null],
      ['guiding-sword', 'linked-edge', 'turning-body', 'breaking-edge'],
    )).toEqual(['guiding-sword', 'linked-edge', 'turning-body', 'breaking-edge']);
  });
});
