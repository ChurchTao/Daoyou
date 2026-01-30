import { describe, expect, it } from '@jest/globals';
import {
  calculateCraftCost,
  getCostDescription,
  calculateMaxQuality,
} from './CraftCostCalculator';
import { Quality } from '@/types/constants';

describe('CraftCostCalculator', () => {
  describe('calculateCraftCost', () => {
    describe('spiritStone cost (exponential growth)', () => {
      it('should calculate correct spirit stone cost for each quality level', () => {
        // 凡品 (level 0): 500 * 2^0 = 500
        expect(calculateCraftCost('凡品', 'spiritStone')).toBe(500);

        // 灵品 (level 1): 500 * 2^1 = 1000
        expect(calculateCraftCost('灵品', 'spiritStone')).toBe(1000);

        // 玄品 (level 2): 500 * 2^2 = 2000
        expect(calculateCraftCost('玄品', 'spiritStone')).toBe(2000);

        // 真品 (level 3): 500 * 2^3 = 4000
        expect(calculateCraftCost('真品', 'spiritStone')).toBe(4000);

        // 地品 (level 4): 500 * 2^4 = 8000
        expect(calculateCraftCost('地品', 'spiritStone')).toBe(8000);

        // 天品 (level 5): 500 * 2^5 = 16000
        expect(calculateCraftCost('天品', 'spiritStone')).toBe(16000);

        // 仙品 (level 6): 500 * 2^6 = 32000
        expect(calculateCraftCost('仙品', 'spiritStone')).toBe(32000);

        // 神品 (level 7): 500 * 2^7 = 64000
        expect(calculateCraftCost('神品', 'spiritStone')).toBe(64000);
      });

      it('should double the cost for each quality level', () => {
        const qualities: Quality[] = [
          '凡品',
          '灵品',
          '玄品',
          '真品',
          '地品',
          '天品',
          '仙品',
          '神品',
        ];

        for (let i = 1; i < qualities.length; i++) {
          const prevCost = calculateCraftCost(qualities[i - 1], 'spiritStone');
          const currentCost = calculateCraftCost(qualities[i], 'spiritStone');
          expect(currentCost).toBe(prevCost * 2);
        }
      });
    });

    describe('comprehension cost (tiered fixed values with cap at 100)', () => {
      it('should calculate correct comprehension cost for each quality', () => {
        expect(calculateCraftCost('凡品', 'comprehension')).toBe(10);
        expect(calculateCraftCost('灵品', 'comprehension')).toBe(20);
        expect(calculateCraftCost('玄品', 'comprehension')).toBe(35);
        expect(calculateCraftCost('真品', 'comprehension')).toBe(55);
        expect(calculateCraftCost('地品', 'comprehension')).toBe(80);
        expect(calculateCraftCost('天品', 'comprehension')).toBe(100);
        expect(calculateCraftCost('仙品', 'comprehension')).toBe(100); // 封顶
        expect(calculateCraftCost('神品', 'comprehension')).toBe(100); // 封顶
      });

      it('should cap comprehension cost at 100 for high-quality materials', () => {
        // 仙品和神品都应该封顶在100
        expect(calculateCraftCost('仙品', 'comprehension')).toBeLessThanOrEqual(
          100,
        );
        expect(calculateCraftCost('神品', 'comprehension')).toBeLessThanOrEqual(
          100,
        );
      });
    });
  });

  describe('getCostDescription', () => {
    it('should return spirit stones cost for alchemy', () => {
      const result = getCostDescription('天品', 'alchemy');
      expect(result).toEqual({ spiritStones: 16000 });
      expect(result.comprehension).toBeUndefined();
    });

    it('should return spirit stones cost for refine', () => {
      const result = getCostDescription('地品', 'refine');
      expect(result).toEqual({ spiritStones: 8000 });
      expect(result.comprehension).toBeUndefined();
    });

    it('should return comprehension cost for create_skill', () => {
      const result = getCostDescription('天品', 'create_skill');
      expect(result).toEqual({ comprehension: 100 });
      expect(result.spiritStones).toBeUndefined();
    });

    it('should return comprehension cost for create_gongfa', () => {
      const result = getCostDescription('玄品', 'create_gongfa');
      expect(result).toEqual({ comprehension: 35 });
      expect(result.spiritStones).toBeUndefined();
    });

    it('should return empty object for unknown craft type', () => {
      const result = getCostDescription('凡品', 'unknown_type');
      expect(result).toEqual({});
      expect(result.spiritStones).toBeUndefined();
      expect(result.comprehension).toBeUndefined();
    });
  });

  describe('calculateMaxQuality', () => {
    it('should return the highest quality from a single material', () => {
      const materials = [{ rank: '灵品' as Quality }];
      expect(calculateMaxQuality(materials)).toBe('灵品');
    });

    it('should return the highest quality from multiple materials', () => {
      const materials = [
        { rank: '凡品' as Quality },
        { rank: '天品' as Quality },
        { rank: '玄品' as Quality },
      ];
      expect(calculateMaxQuality(materials)).toBe('天品');
    });

    it('should handle all quality levels', () => {
      const qualities: Quality[] = [
        '凡品',
        '灵品',
        '玄品',
        '真品',
        '地品',
        '天品',
        '仙品',
        '神品',
      ];

      // Test with shuffled array
      const shuffled = [...qualities].sort(() => Math.random() - 0.5);
      const materials = shuffled.map((rank) => ({ rank }));
      expect(calculateMaxQuality(materials)).toBe('神品');
    });

    it('should handle empty array (returns lowest quality)', () => {
      const materials: Array<{ rank: Quality }> = [];
      expect(calculateMaxQuality(materials)).toBe('凡品');
    });

    it('should handle single lowest quality', () => {
      const materials = [{ rank: '凡品' as Quality }];
      expect(calculateMaxQuality(materials)).toBe('凡品');
    });

    it('should handle single highest quality', () => {
      const materials = [{ rank: '神品' as Quality }];
      expect(calculateMaxQuality(materials)).toBe('神品');
    });

    it('should correctly identify highest when same quality materials', () => {
      const materials = [
        { rank: '地品' as Quality },
        { rank: '地品' as Quality },
        { rank: '地品' as Quality },
      ];
      expect(calculateMaxQuality(materials)).toBe('地品');
    });
  });
});
