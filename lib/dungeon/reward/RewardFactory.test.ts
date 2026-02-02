/**
 * RewardFactory 材料品质生成测试
 *
 * 测试目标：验证材料品质生成公式的分布是否符合预期
 * - 不同地图境界的影响
 * - 不同副本评分的影响
 * - 不同危险系数的影响
 * - 不同AI提示的影响
 * - 分布统计特性
 */

import { QUALITY_VALUES } from '@/types/constants';
import { RewardFactory } from './RewardFactory';
import type { RewardBlueprint } from './types';

// 辅助函数：创建材料蓝图
function createMaterialBlueprint(
  quality_hint: 'lower' | 'medium' | 'upper' = 'medium',
): RewardBlueprint {
  return {
    name: '测试材料',
    description: '用于测试的材料',
    quality_hint,
    element: '火',
    material_type: 'herb',
  };
}

// 辅助函数：批量生成材料并统计品质分布
function generateQualityDistribution(
  realm:
    | '炼气'
    | '筑基'
    | '金丹'
    | '元婴'
    | '化神'
    | '炼虚'
    | '合体'
    | '大乘'
    | '渡劫',
  tier: 'S' | 'A' | 'B' | 'C' | 'D',
  dangerScore: number,
  quality_hint: 'lower' | 'medium' | 'upper' = 'medium',
  sampleSize: number = 1000,
): Record<string, number> {
  const blueprint = createMaterialBlueprint(quality_hint);
  const distribution: Record<string, number> = {};

  // 初始化分布
  QUALITY_VALUES.forEach((q) => (distribution[q] = 0));

  // 批量生成
  for (let i = 0; i < sampleSize; i++) {
    const results = RewardFactory.materialize(
      [blueprint],
      realm,
      tier,
      dangerScore,
    );
    const material = results[0].data as { rank: string };
    const quality = material.rank;
    distribution[quality]++;
  }

  return distribution;
}

// 辅助函数：计算平均品质索引
function calculateAverageQualityIndex(
  distribution: Record<string, number>,
  sampleSize: number,
): number {
  let sum = 0;
  for (let i = 0; i < QUALITY_VALUES.length; i++) {
    const quality = QUALITY_VALUES[i];
    const count = distribution[quality] || 0;
    sum += i * count;
  }
  return sum / sampleSize;
}

// 辅助函数：打印分布表格
function printDistributionTable(
  distribution: Record<string, number>,
  sampleSize: number,
): void {
  console.log('\n品质分布统计:');
  console.log('┌──────────┬──────────┬──────────┐');
  console.log('│ 品质      │ 数量     │ 占比     │');
  console.log('├──────────┼──────────┼──────────┤');

  QUALITY_VALUES.forEach((quality) => {
    const count = distribution[quality] || 0;
    const percentage = ((count / sampleSize) * 100).toFixed(2);
    console.log(
      `│ ${quality.padEnd(8)} │ ${count.toString().padStart(8)} │ ${percentage.padStart(7)}% │`,
    );
  });

  console.log('└──────────┴──────────┴──────────┘');

  const avgIndex = calculateAverageQualityIndex(distribution, sampleSize);
  const avgQuality = QUALITY_VALUES[Math.round(avgIndex)];
  console.log(`\n平均品质索引: ${avgIndex.toFixed(2)}`);
  console.log(`平均品质: ${avgQuality}`);
}

describe('RewardFactory - 材料品质生成测试', () => {
  describe('基础功能测试', () => {
    test('应该成功生成材料奖励', () => {
      const blueprint = createMaterialBlueprint();
      const results = RewardFactory.materialize([blueprint], '筑基', 'B', 50);

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('material');
      expect(results[0].data).toBeDefined();

      const material = results[0].data as { name: string; rank: string };
      expect(material.name).toBe('测试材料');
      expect(material.rank).toBeDefined();
      expect(QUALITY_VALUES).toContain(material.rank);
    });

    test('应该正确设置材料属性', () => {
      const blueprint: RewardBlueprint = {
        name: '火灵芝',
        description: '火焰属性的灵芝',
        quality_hint: 'upper',
        element: '火',
        material_type: 'herb',
      };

      const results = RewardFactory.materialize([blueprint], '金丹', 'A', 70);
      const material = results[0].data as {
        name: string;
        type: string;
        element: string;
        quantity: number;
        price: number;
      };

      expect(material.name).toBe('火灵芝');
      expect(material.type).toBe('herb');
      expect(material.element).toBe('火');
      expect(material.quantity).toBe(1);
      expect(material.price).toBeGreaterThan(0);
    });
  });

  describe('地图境界影响测试', () => {
    test('炼气副本：品质应集中在低等级（凡品、灵品）', () => {
      const distribution = generateQualityDistribution(
        '炼气',
        'C',
        0,
        'medium',
        5000,
      );
      const avgIndex = calculateAverageQualityIndex(distribution, 5000);

      console.log('\n=== 炼气副本 (C级, 危险0) ===');
      printDistributionTable(distribution, 5000);

      // 炼气副本基础索引为0，加上C级(0)和危险0，加上随机偏移，平均应在0-1.5之间
      expect(avgIndex).toBeGreaterThanOrEqual(0);
      expect(avgIndex).toBeLessThan(2);

      // 凡品和灵品应该占大多数
      const lowQualityCount = distribution['凡品'] + distribution['灵品'];
      expect(lowQualityCount / 5000).toBeGreaterThan(0.6);
    });

    test('筑基副本：品质应集中在中等等级（灵品、玄品）', () => {
      const distribution = generateQualityDistribution(
        '筑基',
        'C',
        0,
        'medium',
        5000,
      );
      const avgIndex = calculateAverageQualityIndex(distribution, 5000);

      console.log('\n=== 筑基副本 (C级, 危险0) ===');
      printDistributionTable(distribution, 5000);

      // 筑基副本基础索引为1，加上C级(0)和危险0，加上随机偏移，平均应在0.5-2之间
      expect(avgIndex).toBeGreaterThanOrEqual(0.5);
      expect(avgIndex).toBeLessThan(2.5);

      // 灵品和玄品应该占多数
      const midQualityCount = distribution['灵品'] + distribution['玄品'];
      expect(midQualityCount / 5000).toBeGreaterThan(0.4);
    });

    test('金丹副本：品质应集中在中高等级（玄品、真品）', () => {
      const distribution = generateQualityDistribution(
        '金丹',
        'C',
        0,
        'medium',
        5000,
      );
      const avgIndex = calculateAverageQualityIndex(distribution, 5000);

      console.log('\n=== 金丹副本 (C级, 危险0) ===');
      printDistributionTable(distribution, 5000);

      // 金丹副本基础索引为2，加上C级(0)和危险0，加上随机偏移，平均应在1-3.5之间
      expect(avgIndex).toBeGreaterThanOrEqual(1);
      expect(avgIndex).toBeLessThan(3.5);
    });

    test('元婴副本：品质应集中在高等级（真品、地品）', () => {
      const distribution = generateQualityDistribution(
        '元婴',
        'C',
        0,
        'medium',
        5000,
      );
      const avgIndex = calculateAverageQualityIndex(distribution, 5000);

      console.log('\n=== 元婴副本 (C级, 危险0) ===');
      printDistributionTable(distribution, 5000);

      // 元婴副本基础索引为3，加上C级(0)和危险0，加上随机偏移，平均应在2-4.5之间
      expect(avgIndex).toBeGreaterThanOrEqual(2);
      expect(avgIndex).toBeLessThan(4.5);
    });
  });

  describe('副本评分影响测试', () => {
    test('S级评分应显著提高品质', () => {
      const distS = generateQualityDistribution('筑基', 'S', 0, 'medium', 5000);
      const avgIndexS = calculateAverageQualityIndex(distS, 5000);

      console.log('\n=== 筑基副本 S级评分 (危险0) ===');
      printDistributionTable(distS, 5000);

      // S级加成+2，基础1，期望索引2.5左右（考虑随机偏移）
      expect(avgIndexS).toBeGreaterThan(2);
      expect(avgIndexS).toBeLessThan(5);
    });

    test('A级评分应适度提高品质', () => {
      const distA = generateQualityDistribution('筑基', 'A', 0, 'medium', 5000);
      const avgIndexA = calculateAverageQualityIndex(distA, 5000);

      console.log('\n=== 筑基副本 A级评分 (危险0) ===');
      printDistributionTable(distA, 5000);

      // A级加成+1，基础1，期望索引2左右（玄品级别）
      expect(avgIndexA).toBeGreaterThan(1.5);
      expect(avgIndexA).toBeLessThan(4);
    });

    test('B级评分应小幅提高品质', () => {
      const distB = generateQualityDistribution('筑基', 'B', 0, 'medium', 5000);
      const avgIndexB = calculateAverageQualityIndex(distB, 5000);

      console.log('\n=== 筑基副本 B级评分 (危险0) ===');
      printDistributionTable(distB, 5000);

      // B级加成+0.5，基础1，期望索引1.5左右
      expect(avgIndexB).toBeGreaterThan(1);
      expect(avgIndexB).toBeLessThan(3.5);
    });

    test('C级评分为基础品质', () => {
      const distC = generateQualityDistribution('筑基', 'C', 0, 'medium', 5000);
      const avgIndexC = calculateAverageQualityIndex(distC, 5000);

      console.log('\n=== 筑基副本 C级评分 (危险0) ===');
      printDistributionTable(distC, 5000);

      // C级无加成，基础1，期望索引1左右
      expect(avgIndexC).toBeGreaterThan(0.5);
      expect(avgIndexC).toBeLessThan(3);
    });

    test('D级评分应降低品质', () => {
      const distD = generateQualityDistribution('筑基', 'D', 0, 'medium', 5000);
      const avgIndexD = calculateAverageQualityIndex(distD, 5000);

      console.log('\n=== 筑基副本 D级评分 (危险0) ===');
      printDistributionTable(distD, 5000);

      // D级减成-0.5，基础1，期望索引0.5左右
      expect(avgIndexD).toBeLessThan(2);
    });

    test('评分影响：S > A > B > C > D', () => {
      const distS = generateQualityDistribution('筑基', 'S', 0, 'medium', 2000);
      const distA = generateQualityDistribution('筑基', 'A', 0, 'medium', 2000);
      const distB = generateQualityDistribution('筑基', 'B', 0, 'medium', 2000);
      const distC = generateQualityDistribution('筑基', 'C', 0, 'medium', 2000);
      const distD = generateQualityDistribution('筑基', 'D', 0, 'medium', 2000);

      const avgIndexS = calculateAverageQualityIndex(distS, 2000);
      const avgIndexA = calculateAverageQualityIndex(distA, 2000);
      const avgIndexB = calculateAverageQualityIndex(distB, 2000);
      const avgIndexC = calculateAverageQualityIndex(distC, 2000);
      const avgIndexD = calculateAverageQualityIndex(distD, 2000);

      console.log('\n=== 评分对比测试 (筑基副本, 危险0) ===');
      console.log(`S级平均索引: ${avgIndexS.toFixed(2)}`);
      console.log(`A级平均索引: ${avgIndexA.toFixed(2)}`);
      console.log(`B级平均索引: ${avgIndexB.toFixed(2)}`);
      console.log(`C级平均索引: ${avgIndexC.toFixed(2)}`);
      console.log(`D级平均索引: ${avgIndexD.toFixed(2)}`);

      expect(avgIndexS).toBeGreaterThan(avgIndexA);
      expect(avgIndexA).toBeGreaterThan(avgIndexB);
      expect(avgIndexB).toBeGreaterThan(avgIndexC);
      expect(avgIndexC).toBeGreaterThan(avgIndexD);
    });
  });

  describe('危险系数影响测试', () => {
    test('高危险系数应显著提高品质', () => {
      const distHigh = generateQualityDistribution(
        '筑基',
        'C',
        100,
        'medium',
        5000,
      );
      const avgIndexHigh = calculateAverageQualityIndex(distHigh, 5000);

      console.log('\n=== 筑基副本 C级评分 (危险100) ===');
      printDistributionTable(distHigh, 5000);

      // 基础1 + C级0 + 危险1.5 = 2.5，加上随机
      expect(avgIndexHigh).toBeGreaterThan(2);
      expect(avgIndexHigh).toBeLessThan(5);
    });

    test('低危险系数应略微提高品质', () => {
      const distLow = generateQualityDistribution(
        '筑基',
        'C',
        20,
        'medium',
        5000,
      );
      const avgIndexLow = calculateAverageQualityIndex(distLow, 5000);

      console.log('\n=== 筑基副本 C级评分 (危险20) ===');
      printDistributionTable(distLow, 5000);

      // 基础1 + C级0 + 危险0.3 + 随机偏移，考虑floor操作
      expect(avgIndexLow).toBeGreaterThan(0.5);
      expect(avgIndexLow).toBeLessThan(3);
    });

    test('危险系数影响：100 > 50 > 0', () => {
      const dist100 = generateQualityDistribution(
        '筑基',
        'C',
        100,
        'medium',
        2000,
      );
      const dist50 = generateQualityDistribution(
        '筑基',
        'C',
        50,
        'medium',
        2000,
      );
      const dist0 = generateQualityDistribution('筑基', 'C', 0, 'medium', 2000);

      const avgIndex100 = calculateAverageQualityIndex(dist100, 2000);
      const avgIndex50 = calculateAverageQualityIndex(dist50, 2000);
      const avgIndex0 = calculateAverageQualityIndex(dist0, 2000);

      console.log('\n=== 危险系数对比测试 (筑基副本, C级) ===');
      console.log(`危险100平均索引: ${avgIndex100.toFixed(2)}`);
      console.log(`危险50平均索引: ${avgIndex50.toFixed(2)}`);
      console.log(`危险0平均索引: ${avgIndex0.toFixed(2)}`);

      expect(avgIndex100).toBeGreaterThan(avgIndex50);
      expect(avgIndex50).toBeGreaterThan(avgIndex0);
    });
  });

  describe('AI提示影响测试', () => {
    test('upper提示应提高品质', () => {
      const distUpper = generateQualityDistribution(
        '筑基',
        'C',
        0,
        'upper',
        5000,
      );
      const avgIndexUpper = calculateAverageQualityIndex(distUpper, 5000);

      console.log('\n=== 筑基副本 C级评分 (upper提示, 危险0) ===');
      printDistributionTable(distUpper, 5000);

      // 基础1 + C级0 + upper(+1) = 2
      expect(avgIndexUpper).toBeGreaterThan(1.5);
    });

    test('lower提示应降低品质', () => {
      const distLower = generateQualityDistribution(
        '筑基',
        'C',
        0,
        'lower',
        5000,
      );
      const avgIndexLower = calculateAverageQualityIndex(distLower, 5000);

      console.log('\n=== 筑基副本 C级评分 (lower提示, 危险0) ===');
      printDistributionTable(distLower, 5000);

      // 基础1 + C级0 + lower(-1) = 0
      expect(avgIndexLower).toBeLessThan(1.5);
    });

    test('medium提示为基准', () => {
      const distMedium = generateQualityDistribution(
        '筑基',
        'C',
        0,
        'medium',
        5000,
      );
      const avgIndexMedium = calculateAverageQualityIndex(distMedium, 5000);

      console.log('\n=== 筑基副本 C级评分 (medium提示, 危险0) ===');
      printDistributionTable(distMedium, 5000);

      // 基础1 + C级0 + medium(0) = 1
      expect(avgIndexMedium).toBeGreaterThan(0.5);
      expect(avgIndexMedium).toBeLessThan(2.5);
    });

    test('AI提示影响：upper > medium > lower', () => {
      const distUpper = generateQualityDistribution(
        '筑基',
        'C',
        0,
        'upper',
        2000,
      );
      const distMedium = generateQualityDistribution(
        '筑基',
        'C',
        0,
        'medium',
        2000,
      );
      const distLower = generateQualityDistribution(
        '筑基',
        'C',
        0,
        'lower',
        2000,
      );

      const avgIndexUpper = calculateAverageQualityIndex(distUpper, 2000);
      const avgIndexMedium = calculateAverageQualityIndex(distMedium, 2000);
      const avgIndexLower = calculateAverageQualityIndex(distLower, 2000);

      console.log('\n=== AI提示对比测试 (筑基副本, C级, 危险0) ===');
      console.log(`upper平均索引: ${avgIndexUpper.toFixed(2)}`);
      console.log(`medium平均索引: ${avgIndexMedium.toFixed(2)}`);
      console.log(`lower平均索引: ${avgIndexLower.toFixed(2)}`);

      expect(avgIndexUpper).toBeGreaterThan(avgIndexMedium);
      expect(avgIndexMedium).toBeGreaterThan(avgIndexLower);
    });
  });

  describe('边界情况测试', () => {
    test('最低配置：炼气 + D级 + 危险0 + lower提示', () => {
      const distribution = generateQualityDistribution(
        '炼气',
        'D',
        0,
        'lower',
        5000,
      );

      console.log('\n=== 最低配置测试 ===');
      printDistributionTable(distribution, 5000);

      // 大部分应该是凡品
      expect(distribution['凡品'] / 5000).toBeGreaterThan(0.7);
    });

    test('最高配置：渡劫 + S级 + 危险100 + upper提示', () => {
      const distribution = generateQualityDistribution(
        '渡劫',
        'S',
        100,
        'upper',
        5000,
      );

      console.log('\n=== 最高配置测试 ===');
      printDistributionTable(distribution, 5000);

      // 大部分应该是高等级品质
      const highQualityCount =
        distribution['地品'] +
        distribution['天品'] +
        distribution['仙品'] +
        distribution['神品'];
      expect(highQualityCount / 5000).toBeGreaterThan(0.5);
    });

    test('边界值：危险系数为0', () => {
      const blueprint = createMaterialBlueprint();
      const results = RewardFactory.materialize([blueprint], '筑基', 'C', 0);

      expect(results).toHaveLength(1);
      expect(results[0].data).toBeDefined();
    });

    test('边界值：危险系数为100', () => {
      const blueprint = createMaterialBlueprint();
      const results = RewardFactory.materialize([blueprint], '筑基', 'C', 100);

      expect(results).toHaveLength(1);
      expect(results[0].data).toBeDefined();
    });
  });

  describe('综合场景测试', () => {
    test('最佳场景：高境界 + S级 + 高危险 + upper提示', () => {
      const distribution = generateQualityDistribution(
        '元婴',
        'S',
        90,
        'upper',
        3000,
      );
      const avgIndex = calculateAverageQualityIndex(distribution, 3000);

      console.log('\n=== 最佳场景：元婴 + S级 + 危险90 + upper ===');
      printDistributionTable(distribution, 3000);

      // 基础3 + S级2 + 危险1.35 + upper1 = 7.35，上限7（神品）
      expect(avgIndex).toBeGreaterThan(5);
    });

    test('最差场景：低境界 + D级 + 低危险 + lower提示', () => {
      const distribution = generateQualityDistribution(
        '炼气',
        'D',
        10,
        'lower',
        3000,
      );
      const avgIndex = calculateAverageQualityIndex(distribution, 3000);

      console.log('\n=== 最差场景：炼气 + D级 + 危险10 + lower ===');
      printDistributionTable(distribution, 3000);

      // 基础0 + D级(-0.5) + 危险0.15 + lower(-1) = -1.35，下限0
      expect(avgIndex).toBeLessThan(1.5);
    });

    test('中等场景：中等境界 + B级 + 中等危险 + medium提示', () => {
      const distribution = generateQualityDistribution(
        '金丹',
        'B',
        50,
        'medium',
        3000,
      );
      const avgIndex = calculateAverageQualityIndex(distribution, 3000);

      console.log('\n=== 中等场景：金丹 + B级 + 危险50 + medium ===');
      printDistributionTable(distribution, 3000);

      // 基础2 + B级0.5 + 危险0.75 + medium0 = 3.25
      expect(avgIndex).toBeGreaterThan(2);
      expect(avgIndex).toBeLessThan(5);
    });
  });

  describe('正态分布特性测试', () => {
    test('品质应呈现正态分布（钟形曲线）', () => {
      const distribution = generateQualityDistribution(
        '筑基',
        'C',
        0,
        'medium',
        10000,
      );

      console.log('\n=== 正态分布测试 (样本10000) ===');
      printDistributionTable(distribution, 10000);

      // 找到出现次数最多的品质（众数）
      let maxCount = 0;
      let mode = '';
      QUALITY_VALUES.forEach((quality) => {
        if (distribution[quality] > maxCount) {
          maxCount = distribution[quality];
          mode = quality;
        }
      });

      console.log(`\n众数（最常见品质）: ${mode}`);

      // 验证分布集中在某个范围内
      // 对于筑基+C级+危险0+medium，期望索引约0.7，所以凡品和灵品应该最多
      expect(['凡品', '灵品']).toContain(mode);

      // 验证极值出现次数少（神品基本不会出现）
      expect(distribution['神品']).toBeLessThan(50);
    });
  });
});
