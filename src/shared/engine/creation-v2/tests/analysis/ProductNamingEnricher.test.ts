import {
  DeepSeekProductNamingEnricher,
  ProductNamingFacts,
} from '@shared/engine/creation-v2/analysis/ProductNamingEnricher';
import { describe, expect, it, vi } from 'vitest';

describe('DeepSeekProductNamingEnricher', () => {
  const mockFacts: ProductNamingFacts = {
    productType: 'gongfa',
    projectionQuality: '灵品',
    elementBias: '火',
    dominantTags: ['爆发'],
    rolledAffixes: [
      {
        id: 'test-affix',
        name: '烈焰核心',
        description: '释放纯净火元',
        category: 'gongfa_foundation',
        weight: 1,
        energyCost: 10,
        rollScore: 1,
        rollEfficiency: 1,
        finalMultiplier: 1,
        isPerfect: false,
        effectTemplate: {} as any,
        match: {} as any,
        tags: [],
      },
    ],
    materialNames: ['赤炎矿'],
  };

  it('当未启用环境变量时应返回 null', async () => {
    const enricher = new DeepSeekProductNamingEnricher();
    (enricher as any).enabled = false;
    const result = await enricher.enrich(mockFacts);
    expect(result).toBeNull();
  });

  it('启用时应调用 callAI 并返回正确格式的结果', async () => {
    const enricher = new DeepSeekProductNamingEnricher();
    (enricher as any).enabled = true;

    const mockResponse = {
      object: {
        name: '赤炎焚天诀',
        description: '此功法运转时如置身炼狱，赤炎破脉而出。',
        styleInsight: '火系意象与爆发标签结合',
      },
    };

    // 使用 spyOn 拦截 protected 方法 callAI
    const callAISpy = vi
      .spyOn(enricher as any, 'callAI')
      .mockResolvedValue(mockResponse);

    const result = await enricher.enrich(mockFacts);

    expect(callAISpy).toHaveBeenCalled();
    expect(result).toEqual(mockResponse.object);
  });

  it('应向 prompt 传递最小且格式化后的命名字段', () => {
    const enricher = new DeepSeekProductNamingEnricher();

    const variables = (enricher as any).buildPromptVariables({
      ...mockFacts,
      slotBias: 'weapon',
      userPrompt: '希望名字偏火系剑修一脉',
    });

    expect(variables).toEqual({
      productTypeLabel: '功法典籍',
      projectionQuality: '灵品',
      elementText: '火',
      slotText: '兵刃',
      intentTagsText: '爆发',
      affixesText: '- 烈焰核心：释放纯净火元',
      materialsText: '赤炎矿',
      playerIntentText: '希望名字偏火系剑修一脉',
    });
  });
});
