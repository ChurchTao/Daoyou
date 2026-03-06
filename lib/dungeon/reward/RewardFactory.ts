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
import { YieldCalculator } from '@/engine/yield/YieldCalculator';
import type {
  ElementType,
  MaterialType,
  Quality,
  RealmType,
} from '@/types/constants';
import { QUALITY_VALUES, REALM_VALUES } from '@/types/constants';
import type { Cultivator, Material } from '@/types/cultivator';
import { calculateCultivationExp } from '@/utils/cultivationUtils';
import type { PlayerInfo } from '../types';
import {
  REALM_QUALITY_CAP,
  REALM_REWARD_CONFIG,
  TIER_MULTIPLIER,
} from './rewardConfig';
import type { RewardBlueprint, RewardRangeConfig, ValueRange } from './types';

/**
 * 奖励工厂 - 将 AI 蓝图转化为实际物品
 */
export class RewardFactory {
  /**
   * 根据评级生成基础奖励（灵石、修为、感悟值）
   *
   * S: 大量灵石+修为+感悟
   * A: 中等灵石+修为
   * B: 少量灵石+修为
   * C: 少量灵石
   * D: 少量灵石
   *
   * @param mapRealm 地图境界门槛
   * @param tier 副本评级 (S/A/B/C/D)
   * @param dangerScore 危险系数 (0-100)
   * @param playerInfo 玩家信息
   * @returns 基础奖励操作数组
   */
  static generateBaseRewards(
    mapRealm: RealmType,
    tier: string,
    dangerScore: number,
    playerInfo: PlayerInfo,
  ): ResourceOperation[] {
    const config = REALM_REWARD_CONFIG[mapRealm] || REALM_REWARD_CONFIG['筑基'];
    const dangerBonus = this.getDangerBonus(dangerScore);
    const rewards: ResourceOperation[] = [];

    // 1. 灵石奖励 (基于挂机收益)
    const rewardHours = this.rollRewardHoursByTier(tier);
    const yieldOps = YieldCalculator.calculateYield(mapRealm, rewardHours);
    const spiritStones =
      yieldOps.find((op) => op.type === 'spirit_stones')?.value ?? 0;
    if (spiritStones > 0) {
      rewards.push({
        type: 'spirit_stones',
        value: Math.floor(spiritStones * (1 + dangerBonus * 0.35)),
      });
    }

    // 2. 修为奖励 (基于闭关引擎等效年限)
    const tierYears: Record<string, number> = {
      S: 20,
      A: 10,
      B: 5,
      C: 2,
      D: 1,
    };
    const equivalentYears = tierYears[tier] || 1;

    // 构造一个模拟的 Cultivator 对象以复用修为计算公式
    const mockCultivator = {
      realm: playerInfo.realm.split(' ')[0] as RealmType,
      spiritual_roots: playerInfo.spiritual_roots.map((r) => {
        const match = r.match(/(.*?)\((\d+)\)/);
        return {
          element: match ? match[1] : '金',
          strength: match ? parseInt(match[2], 10) : 50,
        };
      }),
      cultivations: [], // 无法获取功法品级，使用默认系数
      attributes: playerInfo.attributes,
      cultivation_progress: { bottleneck_state: false },
    } as unknown as Cultivator;

    const expResult = calculateCultivationExp(mockCultivator, equivalentYears);
    const cultivationExp = expResult.exp_gained;

    if (cultivationExp > 0) {
      rewards.push({
        type: 'cultivation_exp',
        value: Math.floor(cultivationExp * (1 + dangerBonus * 0.2)),
      });
    }

    // 3. 感悟奖励 (仅 S 评级有)
    if (tier === 'S') {
      const multiplier = TIER_MULTIPLIER[tier] || TIER_MULTIPLIER['C'];
      rewards.push({
        type: 'comprehension_insight',
        value: this.randomInRange(
          config.comprehension_insight,
          multiplier,
          dangerBonus,
        ),
      });
    }

    return rewards;
  }

  /**
   * 评级映射的“等效挂机时长”
   *
   * D/C/B/A/S -> 3/4-5/6-7/8-10/11-12 小时
   */
  private static rollRewardHoursByTier(tier: string): number {
    const hourRangeByTier: Record<string, { min: number; max: number }> = {
      D: { min: 3, max: 3 },
      C: { min: 4, max: 5 },
      B: { min: 6, max: 7 },
      A: { min: 8, max: 10 },
      S: { min: 11, max: 12 },
    };

    const range = hourRangeByTier[tier] || hourRangeByTier.C;
    return Math.floor(range.min + Math.random() * (range.max - range.min + 1));
  }

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
   * 生成完整奖励：基础奖励 + 材料奖励
   *
   * @param blueprints AI 生成的奖励蓝图数组
   * @param mapRealm 地图境界门槛
   * @param tier 副本评级 (S/A/B/C/D)
   * @param dangerScore 危险系数 (0-100)
   * @param playerInfo 玩家信息
   * @returns 完整的资源操作数组
   */
  static generateAllRewards(
    blueprints: RewardBlueprint[],
    mapRealm: RealmType,
    tier: string,
    dangerScore: number,
    playerInfo: PlayerInfo,
  ): ResourceOperation[] {
    // 生成基础奖励（灵石、修为、感悟值）
    const baseRewards = this.generateBaseRewards(
      mapRealm,
      tier,
      dangerScore,
      playerInfo,
    );

    // 实体化材料奖励
    const materialRewards = this.materialize(
      blueprints,
      mapRealm,
      tier,
      dangerScore,
    );

    // 合并返回
    return [...baseRewards, ...materialRewards];
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
    return this.createMaterial(
      blueprint,
      config,
      multiplier,
      dangerBonus,
      mapRealm,
      tier,
    );
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

    // 计算品质（使用新的评分公式）
    const quality = this.rollMaterialQuality(
      mapRealm,
      tier,
      dangerBonus * 200, // 转换回 0-100 的危险分数
      bp.reward_score,
    );

    // 计算价格（带危险分数加成）
    const basePrice = this.randomInRange(
      config.material_price,
      multiplier,
      dangerBonus,
    );

    // 推断并解析材料类型
    const materialType = this.resolveMaterialType(
      bp.material_type,
      bp.description || '',
    );

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
      火: '火',
      焰: '火',
      炎: '火',
      焚: '火',
      水: '水',
      冰: '冰',
      寒: '冰',
      霜: '冰',
      木: '木',
      草: '木',
      藤: '木',
      林: '木',
      花: '木',
      铁: '金',
      剑: '金',
      锐: '金',
      土: '土',
      石: '土',
      岩: '土',
      山: '土',
      雷: '雷',
      电: '雷',
      霆: '雷',
      风: '风',
      气: '风',
      云: '风',
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
   * 采用线性分布逻辑：
   * 最终品级 = 地图境界索引 + 副本评分加成 + 危险分数加成 + 材料评分加成 + 随机微调
   *
   * @param mapRealm 地图境界 (如：筑基)
   * @param tier 副本评分 (S/A/B/C/D)
   * @param dangerScore 危险系数 (0-100)
   * @param rewardScore 材料个体评分 (0-100)
   * @returns 随机生成的材料品质
   */
  private static rollMaterialQuality(
    mapRealm: RealmType,
    tier: string,
    dangerScore: number,
    rewardScore: number = 50,
  ): Quality {
    const realmIndex = REALM_VALUES.indexOf(mapRealm);
    const capQuality = REALM_QUALITY_CAP[mapRealm] || '神品';
    const capIndex = QUALITY_VALUES.indexOf(capQuality);

    // 1. 基础品质索引 (Base Index)
    // 炼气:0(凡品), 筑基:1(灵品), ...
    const baseIndex = Math.min(realmIndex, QUALITY_VALUES.length - 1);

    // 2. 副本评分权重 (Tier Weight)
    // S: +0.6, A: +0.2, B: 0, C: -0.4, D: -0.8
    const tierWeightMap: Record<string, number> = {
      S: 0.6,
      A: 0.2,
      B: 0,
      C: -0.4,
      D: -0.8,
    };
    const tierWeight = tierWeightMap[tier] || 0;

    // 3. 危险分数权重 (Danger Weight): 0-100 -> 0 to 0.4
    const dangerWeight = (dangerScore / 100) * 0.4;

    // 4. 材料评分权重 (Reward Score Weight): 0-100 -> -0.5 to 0.7
    // 0 -> -0.5 (大跌), 50 -> 0 (正常), 100 -> 0.7 (极品)
    const scoreWeight = ((rewardScore - 50) / 50) * 0.6;

    // 5. 随机微调 (Random Offset): [-0.3, 0.3]
    const randomOffset = (Math.random() - 0.5) * 0.6;

    // 6. 计算最终索引
    const finalIndex =
      baseIndex + tierWeight + dangerWeight + scoreWeight + randomOffset;

    // 7. 境界上限控制与边界锁定
    // 规则：通常产出为境界品质，但在评分和危险系数全满时，允许最高跨越 2 个大阶位 (如筑基副本产出真品)
    const maxAllowedIndex = Math.min(capIndex, baseIndex + 2);
    const minAllowedIndex = Math.max(0, baseIndex - 2);

    const lockedIndex = Math.max(
      minAllowedIndex,
      Math.min(
        Math.round(finalIndex),
        maxAllowedIndex,
        QUALITY_VALUES.length - 1,
      ),
    );

    return QUALITY_VALUES[lockedIndex];
  }

  /**
   * 推断并解析材料类型
   */
  private static resolveMaterialType(
    materialType: RewardBlueprint['material_type'] | 'manual' | undefined,
    description: string,
  ): MaterialType {
    // 1. 如果已提供类型且非 deprecated 类型，直接使用
    if (materialType && materialType !== 'manual') {
      return materialType as MaterialType;
    }

    // 2. 否则基于描述进行模糊匹配
    const lowerDesc = description.toLowerCase();

    // 神通秘术
    if (
      lowerDesc.includes('神通') ||
      lowerDesc.includes('秘术') ||
      lowerDesc.includes('术法')
    ) {
      return 'skill_manual';
    }

    // 功法典籍
    if (
      lowerDesc.includes('功法') ||
      lowerDesc.includes('心法') ||
      lowerDesc.includes('经') ||
      lowerDesc.includes('诀')
    ) {
      return 'gongfa_manual';
    }

    // 草药
    if (
      lowerDesc.includes('草') ||
      lowerDesc.includes('药') ||
      lowerDesc.includes('灵芝') ||
      lowerDesc.includes('参')
    ) {
      return 'herb';
    }

    // 矿石
    if (
      lowerDesc.includes('石') ||
      lowerDesc.includes('矿') ||
      lowerDesc.includes('晶') ||
      lowerDesc.includes('铁')
    ) {
      return 'ore';
    }

    // 妖兽
    if (
      lowerDesc.includes('兽') ||
      lowerDesc.includes('妖') ||
      lowerDesc.includes('血') ||
      lowerDesc.includes('骨')
    ) {
      return 'monster';
    }

    // 天材地宝
    if (
      lowerDesc.includes('果') ||
      lowerDesc.includes('宝') ||
      lowerDesc.includes('珠') ||
      lowerDesc.includes('露')
    ) {
      return 'tcdb';
    }

    // 默认
    return 'aux';
  }
}
