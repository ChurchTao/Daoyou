/**
 * 副本奖励系统 - 奖励工厂
 *
 * 将 AI 生成的奖励蓝图转化为实际的 ResourceOperation，
 * 根据地图境界门槛和评级生成具体数值。
 *
 * 重构说明:
 * - 移除 artifact 和 consumable 生成
 * - 添加 dangerScore 参数用于计算危险分数加成
 * - 材料生成简化，使用 AI 提供的元素和类型信息
 */

import type { ResourceOperation } from '@/engine/resource/types';
import type { Quality, RealmType, ElementType } from '@/types/constants';
import { QUALITY_VALUES, REALM_VALUES } from '@/types/constants';
import type { Material } from '@/types/cultivator';
import {
  QUALITY_HINT_OFFSET,
  REALM_REWARD_CONFIG,
  TIER_MULTIPLIER,
} from './rewardConfig';
import type {
  QualityHint,
  RewardBlueprint,
  RewardRangeConfig,
  ValueRange,
} from './types';

/**
 * 奖励工厂 - 将 AI 蓝图转化为实际物品
 */
export class RewardFactory {
  /**
   * 将 AI 蓝图数组转化为实际的 ResourceOperation 数组
   */
  static materialize(
    blueprints: RewardBlueprint[],
    mapRealm: RealmType,
    tier: string,
    dangerScore: number, // 新增：危险分数 0-100
  ): ResourceOperation[] {
    return blueprints.map((bp) =>
      this.materializeOne(bp, mapRealm, tier, dangerScore),
    );
  }

  /**
   * 将单个 AI 蓝图转化为 ResourceOperation
   */
  private static materializeOne(
    blueprint: RewardBlueprint,
    mapRealm: RealmType,
    tier: string,
    dangerScore: number,
  ): ResourceOperation {
    const config = REALM_REWARD_CONFIG[mapRealm] || REALM_REWARD_CONFIG['筑基'];
    const multiplier = TIER_MULTIPLIER[tier] || TIER_MULTIPLIER['C'];
    const dangerBonus = this.getDangerBonus(dangerScore);

    switch (blueprint.type) {
      case 'spirit_stones':
        return {
          type: 'spirit_stones',
          value: this.randomInRange(
            config.spirit_stones,
            multiplier,
            dangerBonus,
          ),
        };

      case 'material':
        return this.createMaterial(
          blueprint,
          config,
          multiplier,
          dangerBonus,
          mapRealm,
          tier,
        );

      case 'cultivation_exp':
        return {
          type: 'cultivation_exp',
          value: this.randomInRange(
            config.cultivation_exp,
            multiplier,
            dangerBonus,
          ),
        };

      case 'comprehension_insight':
        return {
          type: 'comprehension_insight',
          value: this.randomInRange(
            config.comprehension_insight,
            multiplier,
            dangerBonus,
          ),
        };

      default:
        // Fallback: 返回灵石
        console.warn(
          `[RewardFactory] Unknown reward type: ${blueprint.type}, using spirit_stones as fallback`,
        );
        return {
          type: 'spirit_stones',
          value: this.randomInRange(
            config.spirit_stones,
            multiplier,
            dangerBonus,
          ),
        };
    }
  }

  // ============ 具体奖励创建方法 ============

  /**
   * 创建材料奖励
   */
  private static createMaterial(
    bp: RewardBlueprint,
    config: RewardRangeConfig,
    multiplier: ValueRange,
    dangerBonus: number,
    mapRealm: RealmType,
    tier: string,
  ): ResourceOperation {
    // 获取或推断元素
    const element = bp.element || this.inferElement(bp.description || '');

    // 计算品质（使用新的随机公式）
    const quality = this.rollMaterialQuality(
      mapRealm,
      tier,
      dangerBonus * 200, // 转换回 0-100 的危险分数
      bp.quality_hint || 'medium',
    );

    // 计算价格（带危险分数加成）
    const basePrice = this.randomInRange(
      config.material_price,
      multiplier,
      dangerBonus,
    );

    // 推断材料类型
    const materialType = bp.material_type || this.inferMaterialType(bp.description || '');

    const material: Material = {
      name: bp.name || '未知材料',
      type: materialType,
      rank: quality,
      element,
      description: bp.description || '',
      price: Math.floor(basePrice * (1 + dangerBonus * 0.1)), // 危险分数增加价值
      quantity: 1,
    };

    return {
      type: 'material',
      value: 1,
      name: material.name,
      data: material,
    };
  }

  // ============ 辅助方法 ============

  /**
   * 危险分数加成 (0-100 -> 0-0.5)
   */
  private static getDangerBonus(dangerScore: number): number {
    return dangerScore / 200;
  }

  /**
   * 在范围内根据倍率和危险分数随机取值
   */
  private static randomInRange(
    range: ValueRange,
    multiplier: ValueRange,
    dangerBonus: number,
  ): number {
    const span = range.max - range.min;
    const effectiveMin = range.min + span * multiplier.min;
    const effectiveMax = range.min + span * multiplier.max;
    const base = effectiveMin + Math.random() * (effectiveMax - effectiveMin);
    return Math.floor(base * (1 + dangerBonus));
  }

  /**
   * 从描述推断元素类型
   */
  private static inferElement(description: string): ElementType {
    const lowerDesc = description.toLowerCase();
    const elementMap: Record<string, ElementType> = {
      '火': '火', '焰': '火', '炎': '火', '焚': '火',
      '水': '水', '冰': '冰', '寒': '冰', '霜': '冰',
      '木': '木', '草': '木', '藤': '木', '林': '木', '花': '木',
      '铁': '金', '剑': '金', '锐': '金',
      '土': '土', '石': '土', '岩': '土', '山': '土',
      '雷': '雷', '电': '雷', '霆': '雷',
      '风': '风', '气': '风', '云': '风',
    };

    for (const [keyword, element] of Object.entries(elementMap)) {
      if (lowerDesc.includes(keyword)) return element;
    }

    // 默认随机返回一个元素
    const elements: ElementType[] = ['金', '木', '水', '火', '土'];
    return elements[Math.floor(Math.random() * elements.length)];
  }

  /**
   * 随机生成材料品质
   *
   * 基于概率分布的随机公式，综合考虑以下因素：
   * - 地图境界（基础品质锚点）
   * - 副本评分（S/A/B/C/D）
   * - 危险系数（0-100）
   * - AI品质提示（lower/medium/upper）
   *
   * @param mapRealm 地图境界
   * @param tier 副本评分 (S/A/B/C/D)
   * @param dangerScore 危险系数 (0-100)
   * @param qualityHint AI品质提示
   * @returns 随机生成的材料品质
   */
  private static rollMaterialQuality(
    mapRealm: RealmType,
    tier: string,
    dangerScore: number,
    qualityHint: QualityHint,
  ): Quality {
    const realmIndex = REALM_VALUES.indexOf(mapRealm);

    // 1. 基础品质索引：地图境界
    const baseIndex = Math.min(realmIndex, QUALITY_VALUES.length - 1);

    // 2. 副本评分加成
    const tierBonus: Record<string, number> = {
      S: 2.0,
      A: 1.0,
      B: 0.5,
      C: 0,
      D: -0.5,
    };
    const tierOffset = tierBonus[tier] || 0;

    // 3. 危险系数加成 (0-100 -> 0-1.5)
    // 危险分数越高，品质加成越大
    const dangerOffset = (dangerScore / 100) * 1.5;

    // 4. AI品质提示偏移
    const hintOffset = QUALITY_HINT_OFFSET[qualityHint] || 0;

    // 5. 随机偏移（使用 Box-Muller 变换生成正态分布）
    // 标准差为 1.0，表示有约 68% 的概率在期望值的 ±1 范围内
    const randomOffset = this.generateGaussianRandom() * 1.0;

    // 6. 计算最终品质索引
    let finalIndex = baseIndex + tierOffset + dangerOffset + hintOffset + randomOffset;

    // 7. 边界限制：确保在有效范围内
    finalIndex = Math.max(0, Math.min(Math.floor(finalIndex), QUALITY_VALUES.length - 1));

    return QUALITY_VALUES[finalIndex];
  }

  /**
   * 生成标准正态分布随机数（均值=0，标准差=1）
   * 使用 Box-Muller 变换
   */
  private static generateGaussianRandom(): number {
    let u = 0;
    let v = 0;

    // 使用拒绝采样法确保在 (0, 1] 范围内
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();

    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  /**
   * 推断材料类型
   */
  private static inferMaterialType(
    description: string,
  ): 'herb' | 'ore' | 'monster' | 'tcdb' | 'aux' | 'manual' {
    const lowerDesc = description.toLowerCase();
    // 功法/神通典籍优先判断
    if (
      lowerDesc.includes('功法') ||
      lowerDesc.includes('神通') ||
      lowerDesc.includes('秘籍') ||
      lowerDesc.includes('典籍') ||
      lowerDesc.includes('残页') ||
      lowerDesc.includes('经书') ||
      lowerDesc.includes('图谱') ||
      lowerDesc.includes('玉简')
    ) {
      return 'manual';
    }
    if (
      lowerDesc.includes('草') ||
      lowerDesc.includes('花') ||
      lowerDesc.includes('藤') ||
      lowerDesc.includes('叶') ||
      lowerDesc.includes('根') ||
      lowerDesc.includes('药') ||
      lowerDesc.includes('灵芝') ||
      lowerDesc.includes('参')
    ) {
      return 'herb';
    }
    if (
      lowerDesc.includes('石') ||
      lowerDesc.includes('矿') ||
      lowerDesc.includes('晶') ||
      lowerDesc.includes('铁') ||
      lowerDesc.includes('玉') ||
      lowerDesc.includes('金') ||
      lowerDesc.includes('铜')
    ) {
      return 'ore';
    }
    if (
      lowerDesc.includes('兽') ||
      lowerDesc.includes('妖') ||
      lowerDesc.includes('血') ||
      lowerDesc.includes('骨') ||
      lowerDesc.includes('皮') ||
      lowerDesc.includes('牙') ||
      lowerDesc.includes('角')
    ) {
      return 'monster';
    }
    if (
      lowerDesc.includes('果') ||
      lowerDesc.includes('宝') ||
      lowerDesc.includes('珠') ||
      lowerDesc.includes('露') ||
      lowerDesc.includes('丹')
    ) {
      return 'tcdb';
    }
    // 默认为辅助材料
    return 'aux';
  }
}
