import type { Cultivator } from '@shared/types/cultivator';
import {
  calculateCultivationExp,
  calculateExpCap,
  calculateExpLossOnFailure,
  calculateExpProgress,
  calculateNormalInsightGain,
  calculateYearsMultiplier,
  canAttemptBreakthrough,
  createDefaultCultivationProgress,
  getBreakthroughType,
  isBottleneckReached,
} from '@server/utils/cultivationUtils';
import { describe, expect, it } from 'vitest';

describe('CultivationUtils', () => {
  describe('calculateExpCap', () => {
    it('应该正确计算各境界阶段的修为上限', () => {
      expect(calculateExpCap('炼气', '初期')).toBe(2000);
      expect(calculateExpCap('炼气', '圆满')).toBe(6500);
      expect(calculateExpCap('筑基', '初期')).toBe(12000);
      expect(calculateExpCap('金丹', '初期')).toBe(60000);
    });
  });

  describe('createDefaultCultivationProgress', () => {
    it('应该创建默认的修为进度数据', () => {
      const progress = createDefaultCultivationProgress('炼气', '初期');
      expect(progress.cultivation_exp).toBe(0);
      expect(progress.exp_cap).toBe(2000);
      expect(progress.comprehension_insight).toBe(0);
      expect(progress.breakthrough_failures).toBe(0);
      expect(progress.bottleneck_state).toBe(false);
      expect(progress.inner_demon).toBe(false);
      expect(progress.deviation_risk).toBe(0);
    });
  });

  describe('calculateYearsMultiplier', () => {
    it('短期闭关年限系数应较低', () => {
      const mult1 = calculateYearsMultiplier(1);
      expect(mult1).toBeGreaterThan(0.9);
      expect(mult1).toBeLessThan(1.0);
    });

    it('长期闭关年限系数应较高但有递减', () => {
      const mult10 = calculateYearsMultiplier(10);
      const mult100 = calculateYearsMultiplier(100);
      const mult200 = calculateYearsMultiplier(200);

      expect(mult10).toBeGreaterThan(1.0);
      expect(mult100).toBeGreaterThan(mult10);
      expect(mult200).toBeGreaterThan(mult100);
      // 递减效应：200年不应是10年的两倍效率
      expect(mult200 / mult10).toBeLessThan(1.5);
    });

    it('年限为0时应返回1.0', () => {
      expect(calculateYearsMultiplier(0)).toBe(1.0);
    });
  });

  describe('calculateNormalInsightGain', () => {
    it('年限为0时应返回0', () => {
      expect(calculateNormalInsightGain(0)).toBe(0);
    });

    it('结果应在0~20范围内', () => {
      for (let i = 0; i < 50; i++) {
        const result = calculateNormalInsightGain(100);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(20);
      }
    });

    it('年限越长平均感悟值越高', () => {
      const shortResults: number[] = [];
      const longResults: number[] = [];

      for (let i = 0; i < 100; i++) {
        shortResults.push(calculateNormalInsightGain(1, Math.random));
        longResults.push(calculateNormalInsightGain(100, Math.random));
      }

      const shortAvg =
        shortResults.reduce((a, b) => a + b, 0) / shortResults.length;
      const longAvg =
        longResults.reduce((a, b) => a + b, 0) / longResults.length;
      expect(longAvg).toBeGreaterThan(shortAvg);
    });
  });

  describe('calculateCultivationExp', () => {
    it('应该基于灵根强度计算修为', () => {
      const cultivator: Cultivator = {
        name: '测试修士',
        gender: '男',
        realm: '炼气',
        realm_stage: '初期',
        age: 18,
        lifespan: 100,
        attributes: {
          vitality: 50,
          spirit: 50,
          wisdom: 80,
          speed: 50,
          willpower: 50,
        },
        spiritual_roots: [
          { element: '金', strength: 85, grade: '天灵根' }, // 高灵根
        ],
        pre_heaven_fates: [],
        cultivations: [],
        skills: [],
        inventory: {
          artifacts: [],
          consumables: [],
          materials: [],
        },
        equipped: {
          weapon: null,
          armor: null,
          accessory: null,
        },
        max_skills: 4,
        spirit_stones: 0,
        cultivation_progress: createDefaultCultivationProgress('炼气', '初期'),
      };

      const result = calculateCultivationExp(cultivator, 10, () => 0.5);

      expect(result.exp_gained).toBeGreaterThan(0);
      // rng=0.5 不会触发顿悟（0.5 >= 0.05）
      expect(result.epiphany_triggered).toBe(false);
      // 非顿悟时也有常规感悟值
      expect(result.insight_gained).toBeGreaterThanOrEqual(0);
      expect(result.insight_gained).toBeLessThanOrEqual(20);
    });

    it('顿悟概率为固定5%，rng<0.05时应触发', () => {
      const cultivator: Cultivator = {
        name: '测试修士',
        gender: '男',
        realm: '炼气',
        realm_stage: '初期',
        age: 18,
        lifespan: 100,
        attributes: {
          vitality: 50,
          spirit: 50,
          wisdom: 100,
          speed: 50,
          willpower: 50,
        },
        spiritual_roots: [{ element: '金', strength: 70 }],
        pre_heaven_fates: [],
        cultivations: [],
        skills: [],
        inventory: {
          artifacts: [],
          consumables: [],
          materials: [],
        },
        equipped: {
          weapon: null,
          armor: null,
          accessory: null,
        },
        max_skills: 4,
        spirit_stones: 0,
        cultivation_progress: createDefaultCultivationProgress('炼气', '初期'),
      };

      // rng=0.04 时第一次用于randomFactor，第二次用于顿悟判定（0.04<0.05触发）
      const result = calculateCultivationExp(cultivator, 10, () => 0.04);

      expect(result.epiphany_triggered).toBe(true);
      expect(result.insight_gained).toBeGreaterThanOrEqual(20);
      expect(result.insight_gained).toBeLessThanOrEqual(50);
    });

    it('瓶颈期修为获取应减半', () => {
      const makeCultivator = (bottleneck: boolean): Cultivator => ({
        name: '测试修士',
        gender: '男',
        realm: '炼气',
        realm_stage: '初期',
        age: 18,
        lifespan: 100,
        attributes: {
          vitality: 50,
          spirit: 50,
          wisdom: 50,
          speed: 50,
          willpower: 50,
        },
        spiritual_roots: [{ element: '金', strength: 50 }],
        pre_heaven_fates: [],
        cultivations: [],
        skills: [],
        inventory: {
          artifacts: [],
          consumables: [],
          materials: [],
        },
        equipped: {
          weapon: null,
          armor: null,
          accessory: null,
        },
        max_skills: 4,
        spirit_stones: 0,
        cultivation_progress: {
          ...createDefaultCultivationProgress('炼气', '初期'),
          bottleneck_state: bottleneck,
        },
      });

      const normalResult = calculateCultivationExp(
        makeCultivator(false),
        10,
        () => 0.5,
      );
      const bottleneckResult = calculateCultivationExp(
        makeCultivator(true),
        10,
        () => 0.5,
      );

      // 瓶颈期修为应该约为正常的一半
      expect(bottleneckResult.exp_gained).toBeLessThan(normalResult.exp_gained);
      expect(bottleneckResult.exp_gained).toBeLessThanOrEqual(
        Math.ceil(normalResult.exp_gained / 2),
      );
    });
  });

  describe('calculateExpProgress', () => {
    it('应该正确计算修为进度百分比', () => {
      const progress = {
        cultivation_exp: 1000,
        exp_cap: 2000,
        comprehension_insight: 0,
        breakthrough_failures: 0,
        bottleneck_state: false,
        inner_demon: false,
        deviation_risk: 0,
      };

      expect(calculateExpProgress(progress)).toBe(50);
    });

    it('修为满时应该返回100%', () => {
      const progress = {
        cultivation_exp: 2000,
        exp_cap: 2000,
        comprehension_insight: 0,
        breakthrough_failures: 0,
        bottleneck_state: false,
        inner_demon: false,
        deviation_risk: 0,
      };

      expect(calculateExpProgress(progress)).toBe(100);
    });
  });

  describe('isBottleneckReached', () => {
    it('修为低于90%时应该返回false', () => {
      const progress = {
        cultivation_exp: 1600,
        exp_cap: 2000,
        comprehension_insight: 0,
        breakthrough_failures: 0,
        bottleneck_state: false,
        inner_demon: false,
        deviation_risk: 0,
      };

      expect(isBottleneckReached(progress)).toBe(false);
    });

    it('修为达到90%时应该返回true', () => {
      const progress = {
        cultivation_exp: 1800,
        exp_cap: 2000,
        comprehension_insight: 0,
        breakthrough_failures: 0,
        bottleneck_state: false,
        inner_demon: false,
        deviation_risk: 0,
      };

      expect(isBottleneckReached(progress)).toBe(true);
    });
  });

  describe('canAttemptBreakthrough', () => {
    it('修为低于60%时不能突破', () => {
      const progress = {
        cultivation_exp: 1000,
        exp_cap: 2000,
        comprehension_insight: 0,
        breakthrough_failures: 0,
        bottleneck_state: false,
        inner_demon: false,
        deviation_risk: 0,
      };

      expect(canAttemptBreakthrough(progress)).toBe(false);
    });

    it('修为达到60%时可以突破', () => {
      const progress = {
        cultivation_exp: 1200,
        exp_cap: 2000,
        comprehension_insight: 0,
        breakthrough_failures: 0,
        bottleneck_state: false,
        inner_demon: false,
        deviation_risk: 0,
      };

      expect(canAttemptBreakthrough(progress)).toBe(true);
    });
  });

  describe('getBreakthroughType', () => {
    it('修为60%-79%应该是强行突破', () => {
      const progress = {
        cultivation_exp: 1400,
        exp_cap: 2000,
        comprehension_insight: 30,
        breakthrough_failures: 0,
        bottleneck_state: false,
        inner_demon: false,
        deviation_risk: 0,
      };

      expect(getBreakthroughType(progress)).toBe('forced');
    });

    it('修为80%-99%应该是常规突破', () => {
      const progress = {
        cultivation_exp: 1700,
        exp_cap: 2000,
        comprehension_insight: 30,
        breakthrough_failures: 0,
        bottleneck_state: false,
        inner_demon: false,
        deviation_risk: 0,
      };

      expect(getBreakthroughType(progress)).toBe('normal');
    });

    it('修为100%且感悟≥50应该是圆满突破', () => {
      const progress = {
        cultivation_exp: 2000,
        exp_cap: 2000,
        comprehension_insight: 50,
        breakthrough_failures: 0,
        bottleneck_state: false,
        inner_demon: false,
        deviation_risk: 0,
      };

      expect(getBreakthroughType(progress)).toBe('perfect');
    });
  });

  describe('calculateExpLossOnFailure', () => {
    it('强行突破失败应该损失50%-70%修为', () => {
      const progress = {
        cultivation_exp: 1400,
        exp_cap: 2000,
        comprehension_insight: 0,
        breakthrough_failures: 0,
        bottleneck_state: false,
        inner_demon: false,
        deviation_risk: 0,
      };

      const loss = calculateExpLossOnFailure(progress, () => 0.5);
      expect(loss).toBeGreaterThanOrEqual(700); // 50%
      expect(loss).toBeLessThanOrEqual(980); // 70%
    });

    it('感悟值应该减少损失', () => {
      const progressWithInsight = {
        cultivation_exp: 2000,
        exp_cap: 2000,
        comprehension_insight: 100,
        breakthrough_failures: 0,
        bottleneck_state: false,
        inner_demon: false,
        deviation_risk: 0,
      };

      const progressWithoutInsight = {
        ...progressWithInsight,
        comprehension_insight: 0,
      };

      const lossWithInsight = calculateExpLossOnFailure(
        progressWithInsight,
        () => 0.5,
      );
      const lossWithoutInsight = calculateExpLossOnFailure(
        progressWithoutInsight,
        () => 0.5,
      );

      expect(lossWithInsight).toBeLessThan(lossWithoutInsight);
    });
  });
});
