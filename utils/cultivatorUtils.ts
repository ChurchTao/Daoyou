import type { Cultivator } from '../types/cultivator';
import { calculateCultivatorPower } from './powerCalculator';
import { parseAIResponse } from './aiClient';

/**
 * 从 AI 响应创建 Cultivator 对象
 * @param aiResponse AI 返回的 JSON 字符串
 * @param userPrompt 用户原始提示词
 * @returns Cultivator 对象
 */
export function createCultivatorFromAI(
  aiResponse: string,
  userPrompt: string
): Cultivator {
  const data = parseAIResponse(aiResponse);
  
  // 类型安全的字段提取
  const getName = (): string => {
    const name = data.name;
    return typeof name === 'string' ? name : '未命名';
  };

  const getCultivationLevel = (): string => {
    const level = data.cultivationLevel;
    return typeof level === 'string' ? level : '炼气一层';
  };

  const getSpiritRoot = (): string => {
    const root = data.spiritRoot;
    return typeof root === 'string' ? root : '无灵根';
  };

  const getTalents = (): string[] => {
    const talents = data.talents;
    return Array.isArray(talents) 
      ? talents.filter((t): t is string => typeof t === 'string')
      : [];
  };

  const getAppearance = (): string => {
    const appearance = data.appearance;
    return typeof appearance === 'string' ? appearance : '普通修士';
  };

  const getBackstory = (): string => {
    const backstory = data.backstory;
    return typeof backstory === 'string' ? backstory : '来历不明';
  };
  
  const cultivator: Cultivator = {
    id: generateUUID(),
    name: getName(),
    prompt: userPrompt,
    cultivationLevel: getCultivationLevel(),
    spiritRoot: getSpiritRoot(),
    talents: getTalents(),
    appearance: getAppearance(),
    backstory: getBackstory(),
    basePower: 0,
    talentBonus: 0,
    totalPower: 0,
  };

  // 计算战力
  calculateCultivatorPower(cultivator);

  return cultivator;
}

/**
 * 生成 UUID（简单版本，用于 demo）
 * @returns UUID 字符串
 */
export function generateUUID(): string {
  return 'cultivator-' + Date.now() + '-' + Math.random().toString(36).slice(2, 11);
}

/**
 * 验证 Cultivator 对象的完整性
 * @param cultivator 修仙者对象
 * @returns 是否有效
 */
export function validateCultivator(cultivator: Partial<Cultivator>): boolean {
  return !!(
    cultivator.name &&
    cultivator.cultivationLevel &&
    cultivator.spiritRoot &&
    Array.isArray(cultivator.talents) &&
    cultivator.appearance &&
    cultivator.backstory
  );
}

