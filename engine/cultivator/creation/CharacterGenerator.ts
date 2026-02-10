import type {
  CultivationTechnique,
  Cultivator,
  Skill,
} from '@/types/cultivator';
import { object } from '@/utils/aiClient';
import { BASIC_SKILLS, BASIC_TECHNIQUES } from './config';
import {
  getCharacterGenerationPrompt,
  getCharacterGenerationUserPrompt,
} from './prompts';
import { CultivatorAISchema } from './types';
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

    const aiResponse = await object(
      prompt,
      userPrompt,
      {
        schema: CultivatorAISchema,
        schemaName: '修仙真形骨架',
      },
      false,
    );

    const data = aiResponse.object;

    // 2. 数值化生成
    const attributes = generateAttributes(data.aptitude_score);
    const spiritual_roots = generateSpiritualRoots(
      data.aptitude_score,
      data.element_preferences,
    );

    // 确定主灵根（强度最高的）
    const mainRoot = spiritual_roots.reduce((prev, current) =>
      prev.strength > current.strength ? prev : current,
    );

    // 3. 分配功法与神通
    // 功法：主灵根对应的基础功法
    const cultivation = BASIC_TECHNIQUES[mainRoot.element]('黄阶下品');
    const cultivations: CultivationTechnique[] = [cultivation];

    // 神通：主灵根对应的一攻一守
    const skills: Skill[] = [...BASIC_SKILLS[mainRoot.element]];

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

      realm: '炼气',
      realm_stage: '初期',
      age,
      lifespan,

      attributes,
      spiritual_roots,
      cultivations,
      skills,
      max_skills: 2 + Math.floor(attributes.wisdom / 10), // 悟性决定神通上限

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
