import { describe, expect, it } from 'vitest';
import {
  getPathProgress,
  getSectMethodLevelCap,
  getSectMethodTrainingCost,
  validateMeridianNodeIds,
} from '..';
import { HEAVY_SWORD_PATH, SWIFT_SWORD_PATH } from '../../content/lingxiao';

describe('通用宗门成长', () => {
  it('保持心法与流派共用的等级上限和成本曲线', () => {
    expect(getSectMethodLevelCap('筑基', '初期')).toBe(25);
    expect(getSectMethodTrainingCost(0, 1)).toEqual({
      contribution: 1,
      spiritStones: 50,
    });
  });

  it('经脉同时校验流派等级、境界和同层互斥', () => {
    expect(() =>
      validateMeridianNodeIds({
        path: SWIFT_SWORD_PATH,
        nodeIds: ['swift-opening'],
        pathLevel: 4,
        realm: '筑基',
        stage: '初期',
        methods: {},
      }),
    ).toThrow('流派等级');
    expect(() =>
      validateMeridianNodeIds({
        path: SWIFT_SWORD_PATH,
        nodeIds: ['swift-opening', 'swift-hidden-edge'],
        pathLevel: 100,
        realm: '化神',
        stage: '圆满',
        methods: {},
      }),
    ).toThrow('只能选择一个节点');
    expect(
      validateMeridianNodeIds({
        path: HEAVY_SWORD_PATH,
        nodeIds: ['heavy-opening'],
        pathLevel: 5,
        realm: '筑基',
        stage: '初期',
        methods: {},
      }),
    ).toEqual(['heavy-opening']);
  });

  it('六层按统一等级和境界门槛开放', () => {
    expect(
      getPathProgress({
        path: HEAVY_SWORD_PATH,
        pathLevel: 70,
        realm: '化神',
        stage: '中期',
      }).availableLayers,
    ).toEqual([1, 2, 3, 4, 5]);
    expect(
      getPathProgress({
        path: HEAVY_SWORD_PATH,
        pathLevel: 100,
        realm: '化神',
        stage: '圆满',
      }).ultimateAvailable,
    ).toBe(true);
  });
});
