import { AsyncMaterialAnalyzer } from '@/engine/creation-v2/analysis/AsyncMaterialAnalyzer';
import {
  MaterialSemanticEnricher,
  MaterialSemanticEnrichmentReport,
} from '@/engine/creation-v2/analysis/MaterialSemanticEnricher';
import { Material } from '@/types/cultivator';

class StubSemanticEnricher implements MaterialSemanticEnricher {
  constructor(private readonly report: MaterialSemanticEnrichmentReport) {}

  async enrich(): Promise<MaterialSemanticEnrichmentReport> {
    return this.report;
  }
}

describe('AsyncMaterialAnalyzer', () => {
  const materials: Material[] = [
    {
      id: 'mat-fire',
      name: '赤炎铁',
      type: 'ore',
      rank: '玄品',
      quantity: 1,
      element: '火',
      description: '蕴含赤炎与锋锐之气',
    },
  ];

  it('应在规则标签基础上追加 LLM 标签，并写入 metadata.llm', async () => {
    const analyzer = new AsyncMaterialAnalyzer(
      undefined,
      new StubSemanticEnricher({
        status: 'success',
        provider: 'mock',
        batchInsight: '火系进攻材料',
        materials: [
          {
            materialId: 'mat-fire',
            materialName: '赤炎铁',
            addedTags: ['Material.Semantic.Burst'],
            droppedTags: ['unknown.tag'],
            confidence: 0.92,
            reason: '火焰与爆裂意象明显',
          },
        ],
      }),
    );

    const result = await analyzer.analyze(materials);
    expect(result.fingerprints[0].semanticTags).toContain('Material.Semantic.Flame');
    expect(result.fingerprints[0].semanticTags).toContain('Material.Semantic.Burst');
    expect(result.fingerprints[0].metadata?.llm).toEqual({
      status: 'success',
      confidence: 0.92,
      addedTags: ['Material.Semantic.Burst'],
      droppedTags: ['unknown.tag'],
      reason: '火焰与爆裂意象明显',
      batchInsight: '火系进攻材料',
      provider: 'mock',
    });
  });

  it('fallback 时应保留规则标签并标记 metadata.llm.status=fallback', async () => {
    const analyzer = new AsyncMaterialAnalyzer(
      undefined,
      new StubSemanticEnricher({
        status: 'fallback',
        provider: 'mock',
        fallbackReason: 'timeout',
        materials: [
          {
            materialId: 'mat-fire',
            materialName: '赤炎铁',
            addedTags: [],
            droppedTags: [],
            reason: 'timeout',
          },
        ],
      }),
    );

    const result = await analyzer.analyze(materials);
    expect(result.fingerprints[0].semanticTags).toContain('Material.Semantic.Flame');
    expect(result.fingerprints[0].metadata?.llm?.status).toBe('fallback');
    expect(result.fingerprints[0].metadata?.llm?.reason).toBe('timeout');
  });
});