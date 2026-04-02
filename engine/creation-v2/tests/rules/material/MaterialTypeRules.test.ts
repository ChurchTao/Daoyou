import { RuleSet } from '@/engine/creation-v2';
import { MaterialDecision, MaterialFacts } from '@/engine/creation-v2/rules/contracts';
import { MaterialTypeRules } from '@/engine/creation-v2/rules/material/MaterialTypeRules';
import { MaterialFingerprint } from '@/engine/creation-v2/types';

const createFacts = (fingerprints: MaterialFingerprint[]): MaterialFacts => ({
  productType: 'skill',
  fingerprints,
  normalizedTags: fingerprints.flatMap((fp) => [
    ...fp.explicitTags,
    ...fp.semanticTags,
    ...fp.recipeTags,
  ]),
  recipeTags: fingerprints.flatMap((fp) => fp.recipeTags),
  requestedTags: [],
  dominantTags: [],
  totalEnergy: fingerprints.reduce((s, fp) => s + fp.energyValue, 0),
});

const createDecision = (): MaterialDecision => ({
  valid: true,
  normalizedTags: [],
  dominantTags: [],
  recipeTags: [],
  notes: [],
  reasons: [],
  warnings: [],
  trace: [],
});

const oreFingerprint: MaterialFingerprint = {
  materialName: '赤炎精铁',
  materialType: 'ore',
  rank: '玄品',
  quantity: 1,
  explicitTags: ['Material.Type.Ore', 'Material.Quality.玄品', 'Material.Element.Fire'],
  semanticTags: ['Material.Semantic.Flame'],
  recipeTags: ['Recipe.ProductBias.Skill'],
  energyValue: 8,
  rarityWeight: 2,
  element: '火',
};

describe('MaterialTypeRules', () => {
  const ruleSet = new RuleSet([new MaterialTypeRules()], createDecision);

  it('应在有材料指纹时为每个指纹产出 applied trace', () => {
    const decision = ruleSet.evaluate(createFacts([oreFingerprint]));

    const traces = decision.trace.filter((t) => t.ruleId === 'material.type-tags');
    expect(traces).toHaveLength(1);
    expect(traces[0].outcome).toBe('applied');
    expect(traces[0].details?.materialType).toBe('ore');
  });

  it('应在 trace details 中记录 typeTags 数组', () => {
    const decision = ruleSet.evaluate(createFacts([oreFingerprint]));

    const trace = decision.trace.find((t) => t.ruleId === 'material.type-tags');
    const typeTags = trace?.details?.typeTags as string[];
    expect(typeTags).toContain('Material.Type.Ore');
    expect(typeTags).toContain('Material.Element.Fire');
  });

  it('应在多材料时为每个指纹各产出一条 trace', () => {
    const second: MaterialFingerprint = {
      ...oreFingerprint,
      materialName: '玄冰玉髓',
      materialType: 'herb',
      element: undefined,
      explicitTags: ['Material.Type.Herb', 'Material.Quality.玄品'],
    };

    const decision = ruleSet.evaluate(createFacts([oreFingerprint, second]));
    const traces = decision.trace.filter((t) => t.ruleId === 'material.type-tags');

    expect(traces).toHaveLength(2);
  });

  it('应在无材料时产出 skipped trace', () => {
    const decision = ruleSet.evaluate(createFacts([]));

    const trace = decision.trace.find((t) => t.ruleId === 'material.type-tags');
    expect(trace?.outcome).toBe('skipped');
  });
});
