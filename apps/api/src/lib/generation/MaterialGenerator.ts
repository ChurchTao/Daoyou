import {
  BASE_PRICES,
  TYPE_MULTIPLIERS,
} from '@daoyou/shared/engine/material/creation/config';
import { getFallbackMaterialPreset } from '@daoyou/shared/engine/material/creation/fallbackPresets';
import { MaterialGenerator as MaterialSkeletonGenerator } from '@daoyou/shared/engine/material/creation/MaterialGenerator';
import {
  MaterialAISchema,
  type GeneratedMaterial,
  type MaterialRandomOptions,
  type MaterialSkeleton,
} from '@daoyou/shared/engine/material/creation/types';
import {
  type MaterialType,
  type Quality,
} from '@daoyou/shared/types/constants';
import { generateAiArray } from '@server/utils/aiClient.js';
import {
  getMaterialGenerationPrompt,
  getMaterialGenerationUserPrompt,
} from './material-prompts.js';

export class MaterialGenerator extends MaterialSkeletonGenerator {
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
    if (skeletons.some((skeleton) => skeleton.type === 'seed')) {
      throw new Error('灵植种子必须使用 SpiritSeedGenerator 生成');
    }
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
      const aiResponse = await generateAiArray({
        system: prompt,
        prompt: userPrompt,
        elementSchema: MaterialAISchema,
        name: 'MaterialTextList',
        sceneId: 'material-generation',
      });

      // 组合结果
      return skeletons.map((skeleton, index) => {
        const aiData = aiResponse.output[index] || {
          name: '未知材料',
          description: '天道感应模糊...',
          element: skeleton.forcedElement || '金',
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
      // AI 失败时仍返回可发放的材料，避免奖励邮件出现空附件
      return this.buildFallbackMaterials(skeletons);
    }
  }

  private static buildFallbackMaterials(
    skeletons: MaterialSkeleton[],
  ): GeneratedMaterial[] {
    return skeletons.map((skeleton) => {
      const preset = getFallbackMaterialPreset(skeleton.type, skeleton.rank);
      const finalElement = skeleton.forcedElement || preset.element;
      return {
        name: preset.name,
        type: skeleton.type,
        rank: skeleton.rank,
        element: finalElement,
        description: preset.description,
        quantity: skeleton.quantity,
        price: this.calculatePrice(skeleton.rank, skeleton.type),
      };
    });
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
