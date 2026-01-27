import {
  MATERIAL_TYPE_VALUES,
  QUALITY_VALUES,
  type MaterialType,
  type Quality,
} from '@/types/constants';
import { objectArray } from '@/utils/aiClient';
import {
  BASE_PRICES,
  QUALITY_CHANCE_MAP,
  QUANTITY_RANGE_MAP,
  TYPE_CHANCE_MAP,
  TYPE_MULTIPLIERS,
} from './config';
import {
  getMaterialGenerationPrompt,
  getMaterialGenerationUserPrompt,
} from './prompts';
import {
  MaterialAISchema,
  type GeneratedMaterial,
  type MaterialRandomOptions,
  type MaterialSkeleton,
} from './types';

export class MaterialGenerator {
  /**
   * 生成一批随机材料
   * @param count 数量
   * @param options 随机参数配置
   */
  public static async generateRandom(
    count: number = 10,
    options: MaterialRandomOptions = {},
  ): Promise<GeneratedMaterial[]> {
    // 1. 生成随机骨架
    const skeletons = this.generateRandomSkeletons(count, options);
    // 2. 填充详细信息 (AI)
    return this.fillMaterialDetails(skeletons);
  }

  /**
   * 根据指定的骨架生成材料 (批量)
   * 用于系统奖励、副本掉落等确定性场景
   * @param skeletons 指定的骨架列表
   */
  public static async generateFromSkeletons(
    skeletons: MaterialSkeleton[],
  ): Promise<GeneratedMaterial[]> {
    return this.fillMaterialDetails(skeletons);
  }

  // ===== Private Core Logic =====

  /**
   * 核心方法：调用 AI 为骨架填充 Name, Description, Element
   */
  private static async fillMaterialDetails(
    skeletons: MaterialSkeleton[],
  ): Promise<GeneratedMaterial[]> {
    if (skeletons.length === 0) return [];

    const prompt = getMaterialGenerationPrompt();
    const userPrompt = getMaterialGenerationUserPrompt(skeletons);

    try {
      const aiResponse = await objectArray(
        prompt,
        userPrompt,
        {
          schema: MaterialAISchema,
          schemaName: 'MaterialTextList',
        },
        false, // use fast model
      );

      // 组合结果
      return skeletons.map((skeleton, index) => {
        const aiData = aiResponse.object[index] || {
          name: '未知材料',
          description: '天道感应模糊...',
          element: skeleton.forcedElement || '无',
        };

        // 最终元素：优先使用骨架强制指定的，否则使用 AI 生成的
        const finalElement = skeleton.forcedElement || aiData.element;

        // 计算价格
        const price = this.calculatePrice(skeleton.rank, skeleton.type);

        return {
          name: aiData.name,
          type: skeleton.type,
          rank: skeleton.rank,
          element: finalElement,
          description: aiData.description,
          quantity: skeleton.quantity,
          price,
        };
      });
    } catch (error) {
      console.error('Material Generation Failed:', error);
      return [];
    }
  }

  private static generateRandomSkeletons(
    count: number,
    options: MaterialRandomOptions,
  ): MaterialSkeleton[] {
    const skeletons: MaterialSkeleton[] = [];

    for (let i = 0; i < count; i++) {
      // 1. 确定品质
      const rank = options.guaranteedRank || this.randomQuality();

      // 2. 确定类型
      const type = options.specifiedType || this.randomType();

      // 3. 确定数量
      const [min, max] = QUANTITY_RANGE_MAP[rank] || [1, 1];
      const quantity = Math.floor(Math.random() * (max - min + 1)) + min;

      skeletons.push({
        type,
        rank,
        quantity,
        forcedElement: options.specifiedElement,
      });
    }

    return skeletons;
  }

  private static randomQuality(): Quality {
    const rand = Math.random();
    let accumulated = 0;
    for (const quality of QUALITY_VALUES) {
      accumulated += QUALITY_CHANCE_MAP[quality];
      if (rand <= accumulated) return quality;
    }
    return '凡品';
  }

  private static randomType(): MaterialType {
    const rand = Math.random();
    let accumulated = 0;
    for (const type of MATERIAL_TYPE_VALUES) {
      accumulated += TYPE_CHANCE_MAP[type] || 0;
      if (rand <= accumulated) return type;
    }
    return 'herb';
  }

  private static calculatePrice(rank: Quality, type: MaterialType): number {
    const base = BASE_PRICES[rank];
    const multiplier = TYPE_MULTIPLIERS[type] || 1.0;
    const variation = 0.8 + Math.random() * 0.4; // +/- 20%
    let price = Math.floor(base * multiplier * variation);

    if (price > 1000) price = Math.floor(price / 100) * 100;
    else if (price > 100) price = Math.floor(price / 10) * 10;

    return Math.max(1, price);
  }
}
