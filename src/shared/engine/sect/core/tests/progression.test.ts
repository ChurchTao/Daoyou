import { describe, expect, it } from 'vitest';
import {
  getPathProgress,
  getSectMethodLevelCap,
  getSectMethodTrainingCost,
  standardSectProgression,
  validateMeridianNodeIds,
} from '..';
import { HEAVY_SWORD_PATH, SWIFT_SWORD_PATH } from '../../content/lingxiao';

describe('通用宗门成长', () => {
  it('按目标等级的最低境界阶段计算修为与灵石', () => {
    expect(getSectMethodLevelCap('筑基', '初期')).toBe(25);
    expect(getSectMethodTrainingCost(0, 1)).toEqual({
      cultivationExp: 5,
      comprehensionInsight: 0,
      spiritStones: 50,
    });
    expect(getSectMethodTrainingCost(4, 6)).toEqual({
      cultivationExp: 11,
      comprehensionInsight: 0,
      spiritStones: 100,
    });
  });

  it('经脉只允许选择已解锁层且同层互斥', () => {
    expect(() =>
      validateMeridianNodeIds({
        path: SWIFT_SWORD_PATH,
        nodeIds: ['swift-opening'],
        unlockedLayerIds: [],
        methods: {},
      }),
    ).toThrow('尚未解锁');
    expect(() =>
      validateMeridianNodeIds({
        path: SWIFT_SWORD_PATH,
        nodeIds: ['swift-opening', 'swift-hidden-edge'],
        unlockedLayerIds: ['1'],
        methods: {},
      }),
    ).toThrow('只能选择一个节点');
    expect(
      validateMeridianNodeIds({
        path: HEAVY_SWORD_PATH,
        nodeIds: ['heavy-opening'],
        unlockedLayerIds: ['1'],
        methods: {},
      }),
    ).toEqual(['heavy-opening']);
  });

  it('六层按顺序、境界和精确资源成本解锁', () => {
    expect(HEAVY_SWORD_PATH.layers.map((layer) => layer.cost)).toEqual([
      { cultivationExp: 950, comprehensionInsight: 10, spiritStones: 9_500 },
      {
        cultivationExp: 2_500,
        comprehensionInsight: 15,
        spiritStones: 25_000,
      },
      {
        cultivationExp: 13_500,
        comprehensionInsight: 20,
        spiritStones: 135_000,
      },
      {
        cultivationExp: 47_000,
        comprehensionInsight: 25,
        spiritStones: 470_000,
      },
      {
        cultivationExp: 65_000,
        comprehensionInsight: 30,
        spiritStones: 650_000,
      },
      {
        cultivationExp: 125_000,
        comprehensionInsight: 40,
        spiritStones: 1_250_000,
      },
    ]);
    const progress = getPathProgress({
      path: HEAVY_SWORD_PATH,
      unlockedLayerIds: ['1', '2', '3', '4'],
      realm: '化神',
      stage: '中期',
    });
    expect(progress.unlockedLayers.map((layer) => layer.id)).toEqual([
      '1',
      '2',
      '3',
      '4',
    ]);
    expect(progress.nextLayer).toMatchObject({ id: '5' });
    expect(progress.nextLayerAvailable).toBe(true);
    expect(() =>
      standardSectProgression.assertPathLayerUnlock({
        path: HEAVY_SWORD_PATH,
        unlockedLayerIds: ['1'],
        layerId: '3',
        realm: '金丹',
        stage: '圆满',
        methods: {},
      }),
    ).toThrow('按顺序解锁');
  });
});
