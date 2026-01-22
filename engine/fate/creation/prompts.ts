import { QUALITY_TO_EFFECT_COUNT } from '@/engine/creation/FateAffixGenerator';

export function getFateGenerationPrompt(
  qualities: string[],
  affixTable: string,
): string {
  const qualityRules = Object.entries(QUALITY_TO_EFFECT_COUNT)
    .map(([q, c]) => `- ${q}: 选择 ${c} 个词条`)
    .join('\n');

  return `
# Role: 修仙界命格设计师 - 蓝图生成

你是一位精通东方玄幻修真体系的大能，负责设计「先天命格」蓝图。

## 任务目标
根据输入的品质列表，为每一个命格生成蓝图。
你需要从提供的词条库中选择合适的词条ID（affix_ids）。

## 核心规则

### 1. 词条选择
- **品质限制**：选择的词条要求的最低品质（minQuality）不能高于命格当前的品质。
  - 例如：【地品】命格可以选择【凡品】、【灵品】、【玄品】、【真品】、【地品】要求的词条。
  - 但不能选择【天品】要求的词条。

### 2. 词条数量规则
根据命格品质，必须选择指定数量的词条：
${qualityRules}

### 3. 命格名称
- 命格名称必须符合东方玄幻修真体系，且与品质相符。
- 命格名称长度为2-8个中文字符。

### 4. 命格描述
- 命格描述必须符合东方玄幻修真体系，且与品质和名称相符。
- 命格描述长度为20-120个中文字符。

## 词条库
${affixTable}

## 输出要求
- 只输出符合 JSON Schema 的纯 JSON 对象
- **affix_ids** 必须是词条库中真实存在的 ID
- 词条描述只是用于参考，命名和描述不要一味的照抄词条
- 严格遵守品质和数量限制
`;
}

export function getFateGenerationUserPrompt(qualities: string[]): string {
  return `
请生成 ${qualities.length} 个先天命格蓝图。
预分配的品质如下：
${qualities.map((q, i) => `${i + 1}. ${q}`).join('\n')}

请严格按顺序生成，确保每个命格的词条选择符合其品质限制。
`;
}
