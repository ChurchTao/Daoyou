import { AsyncMaterialAnalyzer } from '@/engine/creation-v2/analysis/AsyncMaterialAnalyzer';
import { DefaultMaterialAnalyzer } from '@/engine/creation-v2/analysis/DefaultMaterialAnalyzer';
import { DeepSeekMaterialSemanticEnricher } from '@/engine/creation-v2/analysis/MaterialSemanticEnricher';
import { CreationOrchestrator } from '@/engine/creation-v2/CreationOrchestrator';
import { CreationProductType } from '@/engine/creation-v2/types';
import { MATERIAL_TYPE_VALUES, QUALITY_VALUES } from '@/types/constants';
import { Material } from '@/types/cultivator';

function hasLlmRuntimeConfig(): boolean {
  const provider = process.env.PROVIDER_CHOOSE;

  if (provider === 'ark') {
    return Boolean(
      process.env.ARK_API_KEY &&
      process.env.ARK_BASE_URL &&
      (process.env.ARK_MODEL_FAST_USE || process.env.ARK_MODEL_USE),
    );
  }

  if (provider === 'kimi') {
    return Boolean(
      process.env.KIMI_API_KEY &&
      process.env.KIMI_BASE_URL &&
      (process.env.KIMI_MODEL_FAST_USE || process.env.KIMI_MODEL_USE),
    );
  }

  if (provider === 'alibaba') {
    return Boolean(
      process.env.ALIBABA_API_KEY &&
      process.env.ALIBABA_BASE_URL &&
      (process.env.ALIBABA_MODEL_FAST_USE || process.env.ALIBABA_MODEL_USE),
    );
  }

  return Boolean(
    process.env.OPENAI_API_KEY &&
    process.env.OPENAI_BASE_URL &&
    (process.env.FAST_MODEL || process.env.OPENAI_MODEL),
  );
}

const COVERAGE_MATERIALS: Material[] = [
  {
    id: 'mat-fan-herb',
    name: '晨露灵芽',
    type: 'herb',
    rank: '凡品',
    quantity: 2,
    element: '木',
    description: '山门药圃初生灵芽，蕴含微弱生机与木行温润之意。',
  },
  {
    id: 'mat-ling-ore',
    name: '赤曜玄砂',
    type: 'ore',
    rank: '灵品',
    quantity: 2,
    element: '火',
    description: '火脉矿洞凝结的赤曜砂，锋芒内敛却暗藏爆烈灵压。',
  },
  {
    id: 'mat-xuan-monster',
    name: '裂风狼王獠牙',
    type: 'monster',
    rank: '玄品',
    quantity: 1,
    element: '风',
    description: '裂风狼王残存妖力之牙，带有迅疾与猎杀本能。',
  },
  {
    id: 'mat-zhen-tcdb',
    name: '九幽镇魄晶',
    type: 'tcdb',
    rank: '真品',
    quantity: 1,
    element: '雷',
    description: '封存古阵雷意的镇魄晶，可稳神亦可引爆灵机。',
  },
  {
    id: 'mat-di-aux',
    name: '太虚凝纹砂',
    type: 'aux',
    rank: '地品',
    quantity: 2,
    element: '土',
    description: '炼器辅材，能让灵纹更稳固，兼具守御与承载之性。',
  },
  {
    id: 'mat-tian-gongfa-manual',
    name: '玄天周流经残卷',
    type: 'gongfa_manual',
    rank: '天品',
    quantity: 1,
    description: '上古心法残卷，记载周天搬运与灵海澄明之法门。',
  },
  {
    id: 'mat-xian-skill-manual',
    name: '焚星裂界诀',
    type: 'skill_manual',
    rank: '仙品',
    quantity: 1,
    element: '火',
    description: '剑诀真意在于先凝后爆，讲求一击焚星的极致爆发。',
  },
  {
    id: 'mat-shen-manual',
    name: '太初道藏页',
    type: 'manual',
    rank: '神品',
    quantity: 1,
    description: '道藏残页蕴含时间与空间意象，适合推演高阶造物路径。',
  },
];

const LLM_CASES: Array<{
  sessionId: string;
  productType: CreationProductType;
  materialIds: string[];
  requestedTags?: string[];
}> = [
  {
    sessionId: 'llm-diversity-skill-1',
    productType: 'skill',
    materialIds: [
      'mat-ling-ore',
      'mat-xuan-monster',
      'mat-xian-skill-manual',
      'mat-zhen-tcdb',
    ],
    requestedTags: ['Material.Semantic.Burst', 'Material.Semantic.Flame'],
  },
  {
    sessionId: 'llm-diversity-skill-2',
    productType: 'skill',
    materialIds: ['mat-fan-herb', 'mat-xuan-monster', 'mat-shen-manual'],
    requestedTags: ['Material.Semantic.Sustain', 'Material.Semantic.Spirit'],
  },
  {
    sessionId: 'llm-diversity-skill-3',
    productType: 'skill',
    materialIds: [
      'mat-tian-gongfa-manual',
      'mat-xian-skill-manual',
      'mat-zhen-tcdb',
    ],
    requestedTags: ['Material.Semantic.Thunder', 'Material.Semantic.Manual'],
  },
  {
    sessionId: 'llm-diversity-skill-4',
    productType: 'skill',
    materialIds: ['mat-ling-ore', 'mat-di-aux', 'mat-shen-manual'],
    requestedTags: ['Material.Semantic.Space', 'Material.Semantic.Blade'],
  },
  {
    sessionId: 'llm-diversity-skill-5',
    productType: 'skill',
    materialIds: ['mat-fan-herb', 'mat-ling-ore', 'mat-xian-skill-manual'],
    requestedTags: ['Material.Semantic.Flame', 'Material.Semantic.Sustain'],
  },
  {
    sessionId: 'llm-diversity-artifact-1',
    productType: 'artifact',
    materialIds: ['mat-ling-ore', 'mat-di-aux', 'mat-zhen-tcdb'],
    requestedTags: ['Material.Semantic.Guard', 'Material.Semantic.Spirit'],
  },
  {
    sessionId: 'llm-diversity-artifact-2',
    productType: 'artifact',
    materialIds: ['mat-shen-manual', 'mat-di-aux', 'mat-xuan-monster'],
    requestedTags: ['Material.Semantic.Space', 'Material.Semantic.Burst'],
  },
  {
    sessionId: 'llm-diversity-artifact-3',
    productType: 'artifact',
    materialIds: ['mat-zhen-tcdb', 'mat-ling-ore', 'mat-fan-herb'],
    requestedTags: ['Material.Semantic.Guard', 'Material.Semantic.Thunder'],
  },
  {
    sessionId: 'llm-diversity-artifact-4',
    productType: 'artifact',
    materialIds: ['mat-di-aux', 'mat-tian-gongfa-manual', 'mat-shen-manual'],
    requestedTags: ['Material.Semantic.Manual', 'Material.Semantic.Space'],
  },
  {
    sessionId: 'llm-diversity-artifact-5',
    productType: 'artifact',
    materialIds: ['mat-xuan-monster', 'mat-ling-ore', 'mat-zhen-tcdb'],
    requestedTags: ['Material.Semantic.Burst', 'Material.Semantic.Blade'],
  },
  {
    sessionId: 'llm-diversity-gongfa-1',
    productType: 'gongfa',
    materialIds: ['mat-tian-gongfa-manual', 'mat-shen-manual', 'mat-fan-herb'],
    requestedTags: ['Material.Semantic.Manual', 'Material.Semantic.Spirit'],
  },
  {
    sessionId: 'llm-diversity-gongfa-2',
    productType: 'gongfa',
    materialIds: ['mat-tian-gongfa-manual', 'mat-zhen-tcdb', 'mat-di-aux'],
    requestedTags: ['Material.Semantic.Thunder', 'Material.Semantic.Guard'],
  },
  {
    sessionId: 'llm-diversity-gongfa-3',
    productType: 'gongfa',
    materialIds: ['mat-shen-manual', 'mat-fan-herb', 'mat-di-aux'],
    requestedTags: ['Material.Semantic.Life', 'Material.Semantic.Manual'],
  },
  {
    sessionId: 'llm-diversity-gongfa-4',
    productType: 'gongfa',
    materialIds: ['mat-tian-gongfa-manual', 'mat-ling-ore', 'mat-zhen-tcdb'],
    requestedTags: ['Material.Semantic.Flame', 'Material.Semantic.Spirit'],
  },
  {
    sessionId: 'llm-diversity-gongfa-5',
    productType: 'gongfa',
    materialIds: [
      'mat-xuan-monster',
      'mat-tian-gongfa-manual',
      'mat-shen-manual',
    ],
    requestedTags: ['Material.Semantic.Burst', 'Material.Semantic.Time'],
  },
];

describe('Creation LLM diversity observability', () => {
  const runIfLlm = hasLlmRuntimeConfig() ? it : it.skip;

  runIfLlm(
    '应覆盖全品级全种类材料，并观测到多样化产物与词缀',
    async () => {
      const materialById = new Map(
        COVERAGE_MATERIALS.map((material) => [material.id!, material]),
      );
      const observedRanks = new Set<string>();
      const observedTypes = new Set<string>();

      COVERAGE_MATERIALS.forEach((material) => {
        observedRanks.add(material.rank);
        observedTypes.add(material.type);
      });

      expect(observedRanks).toEqual(new Set(QUALITY_VALUES));
      expect(observedTypes).toEqual(new Set(MATERIAL_TYPE_VALUES));

      const asyncAnalyzer = new AsyncMaterialAnalyzer(
        new DefaultMaterialAnalyzer(),
        new DeepSeekMaterialSemanticEnricher({
          enabled: true,
          timeoutMs: 12000,
          fastModel: true,
          providerName: 'deepseek-structured-live',
        }),
      );
      const orchestrator = new CreationOrchestrator(
        undefined,
        undefined,
        undefined,
        asyncAnalyzer,
      );

      const outcomeKinds = new Set<string>();
      const productNames = new Set<string>();
      const affixIds = new Set<string>();
      const affixCategories = new Set<string>();
      const llmStatuses = new Set<string>();
      const llmAddedTagCountBySession: Record<string, number> = {};
      const affixEnergyCosts: number[] = [];
      const sessionTagCounts: number[] = [];
      const uniqueSessionTags = new Set<string>();
      const successfulProductTypes = new Set<CreationProductType>();
      const failedSessions: Array<{ sessionId: string; reason?: string }> = [];

      for (const testCase of LLM_CASES) {
        const materials = testCase.materialIds.map((materialId) => {
          const found = materialById.get(materialId);
          if (!found) {
            throw new Error(`Unknown material id: ${materialId}`);
          }
          return found;
        });

        const session = await orchestrator.craftAsync({
          sessionId: testCase.sessionId,
          productType: testCase.productType,
          materials,
          requestedTags: testCase.requestedTags,
        });

        if (session.state.phase !== 'outcome_materialized') {
          failedSessions.push({
            sessionId: testCase.sessionId,
            reason: session.state.failureReason,
          });
          continue;
        }

        successfulProductTypes.add(testCase.productType);
        expect(session.state.blueprint).toBeDefined();
        expect(session.state.outcome).toBeDefined();

        outcomeKinds.add(session.state.blueprint!.outcomeKind);
        productNames.add(session.state.blueprint!.productModel.name);

        session.state.rolledAffixes.forEach((affix) => {
          affixIds.add(affix.id);
          affixCategories.add(affix.category);
          affixEnergyCosts.push(affix.energyCost);
        });

        sessionTagCounts.push(session.state.tags.length);
        session.state.tags.forEach((tag) => uniqueSessionTags.add(tag));

        session.state.materialFingerprints.forEach((fingerprint) => {
          const status = fingerprint.metadata?.llm?.status;
          if (status) {
            llmStatuses.add(status);
          }
        });

        llmAddedTagCountBySession[testCase.sessionId] =
          session.state.materialFingerprints
            .map(
              (fingerprint) => fingerprint.metadata?.llm?.addedTags.length ?? 0,
            )
            .reduce((sum, count) => sum + count, 0);
      }

      const diversityReport = {
        caseCount: LLM_CASES.length,
        successCaseCount: LLM_CASES.length - failedSessions.length,
        failedSessions,
        outcomeKinds: Array.from(outcomeKinds),
        uniqueProductNames: productNames.size,
        uniqueAffixIds: affixIds.size,
        affixCategories: Array.from(affixCategories).sort(),
        llmStatuses: Array.from(llmStatuses).sort(),
        affixEnergyCostDistribution: {
          min: Math.min(...affixEnergyCosts),
          max: Math.max(...affixEnergyCosts),
          avg:
            affixEnergyCosts.reduce((sum, value) => sum + value, 0) /
            affixEnergyCosts.length,
        },
        tagDistribution: {
          uniqueTagCount: uniqueSessionTags.size,
          minSessionTagCount: Math.min(...sessionTagCounts),
          maxSessionTagCount: Math.max(...sessionTagCounts),
        },
        llmAddedTagCountBySession,
      };

      // 观测日志用于人工检视 LLM 带来的造物多样性。
      console.log(
        'creation-v2 llm diversity report:',
        JSON.stringify(diversityReport, null, 2),
      );

      expect(LLM_CASES.length - failedSessions.length).toBeGreaterThanOrEqual(
        9,
      );
      expect(successfulProductTypes).toEqual(
        new Set(['skill', 'artifact', 'gongfa']),
      );
      expect(outcomeKinds).toEqual(
        new Set(['active_skill', 'artifact', 'gongfa']),
      );
      expect(productNames.size).toBeGreaterThanOrEqual(4);
      expect(affixIds.size).toBeGreaterThanOrEqual(10);
      expect(affixCategories.size).toBeGreaterThanOrEqual(3);
      expect(uniqueSessionTags.size).toBeGreaterThanOrEqual(20);
      expect(llmStatuses.has('disabled')).toBe(false);
      expect(llmStatuses.size).toBeGreaterThanOrEqual(1);
    },
    180000,
  );

  it('单个材料观察（材料与产物类型匹配）', async () => {

    const asyncAnalyzer = new AsyncMaterialAnalyzer(
      new DefaultMaterialAnalyzer(),
      new DeepSeekMaterialSemanticEnricher({
        enabled: true,
        timeoutMs: 12000,
        fastModel: true,
        providerName: 'deepseek-structured-live',
      }),
    );
    const orchestrator = new CreationOrchestrator(
      undefined,
      undefined,
      undefined,
      asyncAnalyzer,
    );

    const session = await orchestrator.craftAsync({
      sessionId: crypto.randomUUID(),
      productType: 'gongfa',
      materials: [COVERAGE_MATERIALS[5]],
      requestedTags: ['Material.Semantic.Spirit'],
    });

    expect(session.state.phase).toBe('outcome_materialized');
    expect(session.state.blueprint).toBeDefined();
    expect(session.state.outcome).toBeDefined();

    console.log(
      'Single material enrichment report:',
      JSON.stringify(session.state.materialFingerprints),
    );
    console.log(JSON.stringify(session.state.blueprint));

  });

  it('单个材料观察（材料与产物类型不匹配时应失败）', async () => {
    const asyncAnalyzer = new AsyncMaterialAnalyzer(
      new DefaultMaterialAnalyzer(),
      new DeepSeekMaterialSemanticEnricher({
        enabled: true,
        timeoutMs: 12000,
        fastModel: true,
        providerName: 'deepseek-structured-live',
      }),
    );
    const orchestrator = new CreationOrchestrator(
      undefined,
      undefined,
      undefined,
      asyncAnalyzer,
    );

    // 覆盖你遇到的情况：功法秘籍去造 skill，会在配方阶段失败。
    const session = await orchestrator.craftAsync({
      sessionId: crypto.randomUUID(),
      productType: 'skill',
      materials: [COVERAGE_MATERIALS[5]],
      requestedTags: ['Material.Semantic.Spirit'],
    });

    expect(session.state.phase).toBe('failed');
    expect(session.state.blueprint).toBeUndefined();
    expect(session.state.outcome).toBeUndefined();
    expect(session.state.failureReason).toContain('当前材料组合不足以支持 skill 产物');

  });
});
