import { describe, expect, it, jest, afterEach } from '@jest/globals';
import { DeepSeekProductNamingEnricher, ProductNamingFacts } from '@/engine/creation-v2/analysis/ProductNamingEnricher';

describe('DeepSeekProductNamingEnricher', () => {
  const mockFacts: ProductNamingFacts = {
    productType: 'gongfa',
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
        tags: []
      },
    ],
    qualityProfile: {
      maxQuality: '灵品',
      weightedAverageQuality: '灵品',
      minQuality: '灵品',
      maxQualityOrder: 1,
      weightedAverageOrder: 1,
      minQualityOrder: 1,
      qualitySpread: 0,
      totalQuantity: 1,
    },
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
    const callAISpy = jest.spyOn(enricher as any, 'callAI').mockResolvedValue(mockResponse);

    const result = await enricher.enrich(mockFacts);

    expect(callAISpy).toHaveBeenCalled();
    expect(result).toEqual(mockResponse.object);
  });
});
