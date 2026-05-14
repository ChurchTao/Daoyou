import { renderPromptSystem, renderPromptUser } from '@server/lib/prompts';

/**
 * 角色生成 Prompt 模板（系统提示词）
 */
export function getCharacterGenerationPrompt(): string {
  return renderPromptSystem('character-generation');
}

export function getCharacterGenerationUserPrompt(userInput: string) {
  return renderPromptUser('character-generation', { userInput });
}

/**
 * 高安全级别净化：移除空白、数字、标签、危险符号、作弊关键词
 */
export function sanitizePrompt(input: string): string {
  if (!input) return '';

  let cleaned = input;

  // 1. 移除 XML/HTML 标签
  cleaned = cleaned.replace(/<\/?[^>]+(>|$)/g, '');

  // 2. 移除所有数字
  cleaned = cleaned.replace(/\d+/g, '');

  // 3. 移除危险特殊符号（保留修仙常用标点）
  // 保留：中文标点 + · — 等风格符号
  cleaned = cleaned.replace(/[`{}=:$@#%^&*|~<>[\\\]_+]/g, '');

  // 4. 移除所有空白字符（含换行、制表等）
  cleaned = cleaned.replace(/\s+/g, '');

  // 5. 移除高危关键词（不区分大小写，支持中英文）
  const cheatKeywords = [
    '忽略',
    '无视',
    '跳过',
    '覆盖',
    '绕过',
    'override',
    'bypass',
    'skip',
    'ignore',
    '你是',
    '你是一个',
    '你作为',
    '扮演',
    '模拟',
    '假装',
    '输出',
    '返回',
    '打印',
    '直接给',
    '直接输出',
    '给我',
    '生成',
    '不要规则',
    '无视规则',
    '不用管',
    '别管',
    '不管',
    '最大',
    '最高',
    '最强',
    '满级',
    '全属性',
    '所有属性',
    '全部加',
    '无限',
    '无敌',
    '秒杀',
    '必杀',
    '超模',
    '神级',
    '完美',
    '极致',
    '突破上限',
    'max',
    'full',
    'god',
    'op',
    'broken',
  ];

  const keywordPattern = new RegExp(
    cheatKeywords.map((k) => k.replace(/[.*+?^${}()|[\\]/g, '\\$&')).join('|'),
    'gi',
  );

  cleaned = cleaned.replace(keywordPattern, '');
  cleaned = cleaned.replace(/([·—。！？；：、“”‘’（）【】《》])\1+/g, '$1');

  return cleaned;
}
