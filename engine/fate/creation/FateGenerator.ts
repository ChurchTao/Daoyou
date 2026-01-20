import { objectArray } from '@/utils/aiClient';
import { QUALITY_VALUES, type Quality, type RealmType } from '@/types/constants';
import { buildAffixTable } from '@/engine/creation/AffixUtils';
import { FATE_AFFIXES } from '@/engine/creation/affixes/fateAffixes';
import { FateAffixGenerator } from '@/engine/creation/FateAffixGenerator';
import { FATE_QUALITY_CHANCE_MAP } from './config';
import { getFateGenerationPrompt, getFateGenerationUserPrompt } from './prompts';
import {
  FateBlueprintSchema,
  type FateBlueprint,
  type FateGenerationOptions,
  type GeneratedFate,
} from './types';

export class FateGenerator {
  /**
   * 生成先天命格
   * @param options 生成选项
   */
  public static async generate(
    options: FateGenerationOptions = {},
  ): Promise<GeneratedFate[]> {
    const count = options.count || 1;
    const realm = options.realm || '炼气';

    // 1. 确定品质分布
    const qualities = options.guaranteedQualities || this.getRandomQualities(count);

    // 2. 生成蓝图 (AI)
    const blueprints = await this.generateBlueprints(qualities);

    // 3. 数值化蓝图
    return this.materialize(blueprints, qualities, realm);
  }

  /**
   * 随机品质生成
   */
  private static getRandomQualities(count: number): Quality[] {
    const result: Quality[] = [];
    for (let i = 0; i < count; i++) {
      const random = Math.random();
      let accumulated = 0;
      let selected: Quality = '凡品';

      for (const quality of QUALITY_VALUES) {
        accumulated += FATE_QUALITY_CHANCE_MAP[quality];
        if (random <= accumulated) {
          selected = quality;
          break;
        }
      }
      result.push(selected);
    }
    return result;
  }

  /**
   * 调用 AI 生成蓝图
   */
  private static async generateBlueprints(
    qualities: Quality[],
  ): Promise<FateBlueprint[]> {
    const affixTable = buildAffixTable(FATE_AFFIXES, {
      showSlots: false,
      showQuality: true,
    });

    const prompt = getFateGenerationPrompt(qualities, affixTable);
    const userPrompt = getFateGenerationUserPrompt(qualities);

    try {
      const result = await objectArray(
        prompt,
        userPrompt,
        {
          schema: FateBlueprintSchema,
          schemaName: 'FateBlueprintList',
        },
        false,
      );
      return result.object;
    } catch (error) {
      console.error('[FateGenerator] Blueprint generation failed:', error);
      throw new Error('天道紊乱，命格蓝图生成失败');
    }
  }

  /**
   * 将蓝图数值化
   */
  private static materialize(
    blueprints: FateBlueprint[],
    qualities: Quality[],
    realm: RealmType,
  ): GeneratedFate[] {
    return qualities.map((quality, index) => {
      const blueprint = blueprints[index];
      
      // 如果 AI 返回数量不对或缺失，提供降级处理
      if (!blueprint) {
        return {
          name: '无名命格',
          quality,
          effects: FateAffixGenerator.generateRandom(quality, realm),
          description: '天道感应模糊产生的残缺命格。',
        };
      }

      try {
        const effects = FateAffixGenerator.generate(
          quality,
          realm,
          blueprint.affix_ids,
        );
        return {
          name: blueprint.name,
          quality,
          effects,
          description: blueprint.description,
        };
      } catch (error) {
        console.warn(`[FateGenerator] Materialization failed for ${blueprint.name}:`, error);
        return {
          name: blueprint.name,
          quality,
          effects: FateAffixGenerator.generateRandom(quality, realm),
          description: blueprint.description + ' (天道修正)',
        };
      }
    });
  }
}
