import { generateAiObject } from '@server/utils/aiClient';
import type {
  CultivationTechnique,
  Cultivator,
  Skill,
} from '@shared/types/cultivator';
import {
  getCharacterGenerationPrompt,
  getCharacterGenerationUserPrompt,
} from './prompts';
import { CultivatorAIRawSchema, normalizeCultivatorAIData } from './types';
import { generateAttributes, generateSpiritualRoots } from './utils';

export class CharacterGenerator {
  /**
   * 生成新角色
   * @param userInput 用户输入的描述/提示词
   */
  public static async generate(
    userInput: string,
  ): Promise<{ cultivator: Cultivator; balanceNotes: string }> {
    // 1. 调用 AI 生成角色骨架
    const prompt = getCharacterGenerationPrompt();
    const userPrompt = getCharacterGenerationUserPrompt(userInput);

    const aiResponse = await generateAiObject({
      system: prompt,
      prompt: userPrompt,
      schema: CultivatorAIRawSchema,
      name: '修仙真形骨架',
      sceneId: 'character-generation',
    });

    const data = normalizeCultivatorAIData(aiResponse.output);

    // 2. 数值化生成
    const attributes = generateAttributes();
    const spiritual_roots = generateSpiritualRoots(
      data.aptitude_score,
      data.element_preferences,
    );

    // V6 构筑独立初始化，不再生产旧功法或神通。
    const cultivations: CultivationTechnique[] = [];
    const skills: Skill[] = [];

    // 4. 其他基础数值
    const age = 14 + Math.floor(Math.random() * 6); // 14-20岁
    // 寿元：炼气期基础100，分数高加成
    const lifespan =
      80 + Math.floor(Math.random() * 20) + (data.aptitude_score > 80 ? 20 : 0);

    // 构造完整的 Cultivator 对象
    const cultivator: Cultivator = {
      id: '', // Placeholder
      name: data.name,
      gender: data.gender,
      origin: data.origin,
      personality: data.personality,
      background: data.background,
      playerRace: 'human',
      raceNarrative: data.race_narrative,

      realm: '炼气',
      realm_stage: '初期',
      age,
      lifespan,

      attributes,
      spiritual_roots,
      cultivations,
      skills,
      status: 'active',
      spirit_stones: 0,
      pre_heaven_fates: [], // 后续流程生成
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
      prompt: userInput,
      balance_notes: data.balance_notes,
    };

    return {
      cultivator,
      balanceNotes: data.balance_notes,
    };
  }
}
