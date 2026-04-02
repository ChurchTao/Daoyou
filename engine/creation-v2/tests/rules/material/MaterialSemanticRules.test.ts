import { RuleSet } from '@/engine/creation-v2';
import { MaterialDecision, MaterialFacts } from '@/engine/creation-v2/rules/contracts';
import { MaterialSemanticRules } from '@/engine/creation-v2/rules/material/MaterialSemanticRules';
import { MaterialFingerprint } from '@/engine/creation-v2/types';

const createFacts = (fingerprints: MaterialFingerprint[]): MaterialFacts => ({
  productType: 'skill',
  fingerprints,
  normalizedTags: [],
  recipeTags: [],
  requestedTags: [],
  dominantTags: [],
  totalEnergy: 0,
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

const withSemanticTags: MaterialFingerprint = {
  materialName: '赤炎精铁',
  materialType: 'ore',
  rank: '玄品',
  quantity: 1,
  explicitTags: ['Material.Type.Ore'],
  semanticTags: ['Material.Semantic.Flame', 'Material.Semantic.Blade'],
  recipeTags: [],
  energyValue: 8,
  rarityWeight: 2,
};

const noSemanticTags: MaterialFingerprint = {
  materialName: '普通石料',
  materialType: 'ore',
  rank: '凡品',
  quantity: 1,
  explicitTags: ['Material.Type.Ore'],
  semanticTags: [],
  recipeTags: [],
  energyValue: 4,
  rarityWeight: 1,
};

describe('MaterialSemanticRules', () => {
  const ruleSet = new RuleSet([new MaterialSemanticRules()], createDecision);

  it('应为有语义标签的指纹产出 applied trace', () => {
    const decision = ruleSet.evaluate(createFacts([withSemanticTags]));

    const trace = decision.trace.find((t) => t.ruleId === 'material.semantic-tags');
    expect(trace?.outcome).toBe('applied');
    expect(trace?.details?.semanticTags).toEqual(
      expect.arrayContaining(['Material.Semantic.Flame', 'Material.Semantic.Blade']),
    );
  });

  it('应为无语义标签的指纹产出 skipped trace', () => {
    const decision = ruleSet.evaluate(createFacts([noSemanticTags]));

    const trace = decision.trace.find((t) => t.ruleId === 'material.semantic-tags');
    expect(trace?.outcome).toBe('skipped');
    expect(trace?.details?.materialName).toBe('普通石料');
  });

  it('应在混合材料时按指纹分别产出 applied/skipped', () => {
    const decision = ruleSet.evaluate(createFacts([withSemanticTags, noSemanticTags]));

    const traces = decision.trace.filter((t) => t.ruleId === 'material.semantic-tags');
    expect(traces).toHaveLength(2);
    expect(traces.map((t) => t.outcome)).toContain('applied');
    expect(traces.map((t) => t.outcome)).toContain('skipped');
  });

  it('应在无材料时产出 skipped trace', () => {
    const decision = ruleSet.evaluate(createFacts([]));

    const trace = decision.trace.find((t) => t.ruleId === 'material.semantic-tags');
    expect(trace?.outcome).toBe('skipped');
  });
});
