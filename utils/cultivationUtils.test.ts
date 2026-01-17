import type { Cultivator } from '@/types/cultivator';
import {
  calculateCultivationExp,
  calculateExpCap,
  calculateExpLossOnFailure,
  calculateExpProgress,
  canAttemptBreakthrough,
  createDefaultCultivationProgress,
  getBreakthroughType,
  isBottleneckReached,
} from '@/utils/cultivationUtils';
import { describe, expect, it } from '@jest/globals';

describe('CultivationUtils', () => {
  describe('calculateExpCap', () => {
    it('应该正确计算各境界阶段的修为上限', () => {
      expect(calculateExpCap('炼气', '初期')).toBe(1000);
      expect(calculateExpCap('炼气', '圆满')).toBe(3000);
      expect(calculateExpCap('筑基', '初期')).toBe(5000);
      expect(calculateExpCap('金丹', '初期')).toBe(30000);
    });
  });

  describe('createDefaultCultivationProgress', () => {
    it('应该创建默认的修为进度数据', () => {
      const progress = createDefaultCultivationProgress('炼气', '初期');
      expect(progress.cultivation_exp).toBe(0);
      expect(progress.exp_cap).toBe(1000);
      expect(progress.comprehension_insight).toBe(0);
      expect(progress.breakthrough_failures).toBe(0);
      expect(progress.bottleneck_state).toBe(false);
      expect(progress.inner_demon).toBe(false);
      expect(progress.deviation_risk).toBe(0);
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
      expect(result.epiphany_triggered).toBe(false);
      expect(result.insight_gained).toBe(0);
    });

    it('高悟性应该增加顿悟概率', () => {
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
          wisdom: 100, // 高悟性
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

      // 使用固定RNG触发顿悟
      const result = calculateCultivationExp(cultivator, 10, () => 0.04);

      expect(result.epiphany_triggered).toBe(true);
      expect(result.insight_gained).toBeGreaterThan(0);
    });
  });

  describe('calculateExpProgress', () => {
    it('应该正确计算修为进度百分比', () => {
      const progress = {
        cultivation_exp: 500,
        exp_cap: 1000,
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
        cultivation_exp: 1000,
        exp_cap: 1000,
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
        cultivation_exp: 800,
        exp_cap: 1000,
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
        cultivation_exp: 900,
        exp_cap: 1000,
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
        cultivation_exp: 500,
        exp_cap: 1000,
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
        cultivation_exp: 600,
        exp_cap: 1000,
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
        cultivation_exp: 700,
        exp_cap: 1000,
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
        cultivation_exp: 850,
        exp_cap: 1000,
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
        cultivation_exp: 1000,
        exp_cap: 1000,
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
        cultivation_exp: 700,
        exp_cap: 1000,
        comprehension_insight: 0,
        breakthrough_failures: 0,
        bottleneck_state: false,
        inner_demon: false,
        deviation_risk: 0,
      };

      const loss = calculateExpLossOnFailure(progress, () => 0.5);
      expect(loss).toBeGreaterThanOrEqual(350); // 50%
      expect(loss).toBeLessThanOrEqual(490); // 70%
    });

    it('感悟值应该减少损失', () => {
      const progressWithInsight = {
        cultivation_exp: 1000,
        exp_cap: 1000,
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
