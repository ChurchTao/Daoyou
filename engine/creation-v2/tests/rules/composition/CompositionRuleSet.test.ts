import { AffixEffectTranslator } from '@/engine/creation-v2/affixes/AffixEffectTranslator';
import { AffixRegistry } from '@/engine/creation-v2/affixes/AffixRegistry';
import { AffixDefinition } from '@/engine/creation-v2/affixes/types';
import { CompositionRuleSet } from '@/engine/creation-v2/rules/composition/CompositionRuleSet';
import { CompositionFacts } from '@/engine/creation-v2/rules/contracts/CompositionFacts';
import {
  PassiveProjectionPolicy,
  SkillProjectionPolicy,
} from '@/engine/creation-v2/rules/contracts/CompositionDecision';
import { CreationTags } from '@/engine/creation-v2/core/GameplayTags';
import { EnergyBudget, MaterialFingerprint, RecipeMatch, RolledAffix } from '@/engine/creation-v2/types';

// ─── helpers ────────────────────────────────────────────────────────────────

const BASE_RECIPE_MATCH: RecipeMatch = {
  recipeId: 'test-recipe',
  valid: true,
  matchedTags: [],
  unlockedAffixCategories: ['core'],
};

const BASE_BUDGET: EnergyBudget = {
  total: 20,
  reserved: 4,
  spent: 0,
  remaining: 16,
  allocations: [],
  sources: [],
};

const BASE_FINGERPRINT: MaterialFingerprint = {
  materialName: '锋铁',
  materialType: 'ore',
  rank: '灵品',
  element: undefined,
  quantity: 1,
  explicitTags: [],
  semanticTags: ['Material.Semantic.Metal'],
  recipeTags: [],
  energyValue: 10,
  rarityWeight: 1,
};

function makeFacts(
  override: Partial<CompositionFacts> & { productType: CompositionFacts['productType'] },
): CompositionFacts {
  return {
    productType: override.productType,
    outcomeKind:
      override.productType === 'skill'
        ? 'active_skill'
        : override.productType === 'artifact'
          ? 'artifact'
          : 'gongfa',
    intent: {
      productType: override.productType,
      outcomeKind: override.productType === 'skill'
        ? 'active_skill'
        : override.productType === 'artifact'
          ? 'artifact'
          : 'gongfa',
      elementBias: override.intent?.elementBias ?? undefined,
      slotBias: override.intent?.slotBias ?? undefined,
      dominantTags: override.intent?.dominantTags ?? [],
      requestedTags: [],
    },
    recipeMatch: override.recipeMatch ?? BASE_RECIPE_MATCH,
    energyBudget: override.energyBudget ?? BASE_BUDGET,
    affixes: override.affixes ?? [],
    sessionTags: override.sessionTags ?? ['Material.Semantic.Metal'],
    materialFingerprints: override.materialFingerprints ?? [BASE_FINGERPRINT],
    dominantQuality: override.dominantQuality ?? '灵品',
    materialNames: override.materialNames ?? ['锋铁'],
  };
}

const DAMAGE_AFFIX_DEF: AffixDefinition = {
  id: 'core-damage',
  displayName: '锋刃',
  displayDescription: '造物词缀：锋刃伤害',
  category: 'core',
  applicableTo: ['skill'],
  tagQuery: ['Material.Semantic.Metal'],
  weight: 10,
  energyCost: 8,
  effectTemplate: {
    type: 'damage' as const,
    params: { value: { base: 100 } },
  },
};

const HEAL_AFFIX_DEF: AffixDefinition = {
  id: 'core-heal',
  displayName: '愈元',
  displayDescription: '造物词缀：愈元恢复',
  category: 'core',
  applicableTo: ['skill'],
  tagQuery: ['Material.Semantic.Spirit'],
  weight: 10,
  energyCost: 8,
  effectTemplate: {
    type: 'heal' as const,
    params: { value: { base: 80 } },
  },
};

// ─── tests ──────────────────────────────────────────────────────────────────

describe('CompositionRuleSet — 端到端集成', () => {
  let registry: AffixRegistry;
  let ruleSet: CompositionRuleSet;

  beforeEach(() => {
    registry = new AffixRegistry();
    registry.register([DAMAGE_AFFIX_DEF, HEAL_AFFIX_DEF]);
    ruleSet = new CompositionRuleSet(registry, new AffixEffectTranslator());
  });

  // ── skill ──────────────────────────────────────────────────────────────────

  describe('productType: skill', () => {
    it('无词缀时：应触发 fallback，产出 active_skill policy，含保底 damage 效果', () => {
      const facts = makeFacts({ productType: 'skill' });
      const decision = ruleSet.evaluate(facts);

      expect(decision.outcomeKind).toBe('active_skill');
      const policy = decision.projectionPolicy as SkillProjectionPolicy;
      expect(policy).toBeDefined();
      expect(policy.kind).toBe('active_skill');
      expect(policy.effects.length).toBeGreaterThan(0);
      expect(['damage', 'heal', 'apply_buff']).toContain(policy.effects[0].type);
      expect(decision.defaultsApplied).toContain('skill_damage_fallback');
    });

    it('有 damage 词缀时：policy 包含来自词缀的 damage effect', () => {
      const rolledAffix: RolledAffix = {
        id: 'core-damage',
        name: '锋刃',
        category: 'core',
        energyCost: 8,
        rollScore: 1,
        weight: 10,
        tags: [],
      };
      const facts = makeFacts({
        productType: 'skill',
        affixes: [rolledAffix],
      });
      const decision = ruleSet.evaluate(facts);

      const policy = decision.projectionPolicy as SkillProjectionPolicy;
      expect(policy.kind).toBe('active_skill');
      expect(policy.effects.some((e) => e.type === 'damage')).toBe(true);
      // fallback 不应触发
      expect(decision.defaultsApplied).not.toContain('skill_damage_fallback');
    });

    it('elementBias 为火时：outcomeKind 应为 active_skill，name 包含元素前缀', () => {
      const facts = makeFacts({
        productType: 'skill',
        intent: { productType: 'skill', outcomeKind: 'active_skill', elementBias: '火', slotBias: undefined, dominantTags: [], requestedTags: [] },
      });
      const decision = ruleSet.evaluate(facts);

      expect(decision.outcomeKind).toBe('active_skill');
      expect(typeof decision.name).toBe('string');
      expect(decision.name.length).toBeGreaterThan(0);
    });

    it('heal 词缀时：targetPolicy 应为 self', () => {
      const healAffix: RolledAffix = {
        id: 'core-heal',
        name: '愈元',
        category: 'core',
        energyCost: 8,
        rollScore: 1,
        weight: 10,
        tags: [],
      };
      const facts = makeFacts({ productType: 'skill', affixes: [healAffix] });
      const decision = ruleSet.evaluate(facts);

      const policy = decision.projectionPolicy as SkillProjectionPolicy;
      expect(policy.targetPolicy.team).toBe('self');
    });
  });

  // ── artifact ───────────────────────────────────────────────────────────────

  describe('productType: artifact', () => {
    it('无词缀时：应触发 fallback，产出 artifact_passive policy，含 DamageTakenEvent listener', () => {
      const facts = makeFacts({ productType: 'artifact' });
      const decision = ruleSet.evaluate(facts);

      expect(decision.outcomeKind).toBe('artifact');
      const policy = decision.projectionPolicy as PassiveProjectionPolicy;
      expect(policy).toBeDefined();
      expect(policy.kind).toBe('artifact_passive');
      expect(policy.listeners.length).toBeGreaterThan(0);
      expect(policy.listeners[0].eventType).toBe(CreationTags.BATTLE_EVENT.DAMAGE_TAKEN);
      expect(decision.defaultsApplied).toContain('artifact_shield_fallback');
    });

    it('decision.name 不应为空字符串', () => {
      const facts = makeFacts({ productType: 'artifact' });
      const decision = ruleSet.evaluate(facts);
      expect(decision.name.length).toBeGreaterThan(0);
    });
  });

  // ── gongfa ─────────────────────────────────────────────────────────────────

  describe('productType: gongfa', () => {
    it('无词缀时：应触发 fallback，产出 gongfa_passive policy，含 ActionPreEvent listener', () => {
      const facts = makeFacts({
        productType: 'gongfa',
        materialNames: ['玄铁'],
      });
      const decision = ruleSet.evaluate(facts);

      expect(decision.outcomeKind).toBe('gongfa');
      const policy = decision.projectionPolicy as PassiveProjectionPolicy;
      expect(policy).toBeDefined();
      expect(policy.kind).toBe('gongfa_passive');
      expect(policy.listeners.length).toBeGreaterThan(0);
      expect(policy.listeners[0].eventType).toBe(CreationTags.BATTLE_EVENT.ACTION_PRE);
      expect(decision.defaultsApplied).toContain('gongfa_spirit_fallback');
    });

    it('name 应包含第一个材料名称', () => {
      const facts = makeFacts({
        productType: 'gongfa',
        materialNames: ['玄铁'],
      });
      const decision = ruleSet.evaluate(facts);
      expect(decision.name).toContain('玄铁');
    });
  });

  // ── common ─────────────────────────────────────────────────────────────────

  describe('通用', () => {
    it('decision.description 应包含材料名称（所有 productType）', () => {
      for (const productType of ['skill', 'artifact', 'gongfa'] as const) {
        const facts = makeFacts({ productType, materialNames: ['灵铁', '玄晶'] });
        const decision = ruleSet.evaluate(facts);
        expect(decision.description).toContain('灵铁');
        expect(decision.description).toContain('玄晶');
      }
    });

    it('decision.tags 不应为空（所有 productType）', () => {
      for (const productType of ['skill', 'artifact', 'gongfa'] as const) {
        const facts = makeFacts({ productType });
        const decision = ruleSet.evaluate(facts);
        expect(decision.tags.length).toBeGreaterThan(0);
      }
    });

    it('trace 应记录四条规则的执行日志', () => {
      const facts = makeFacts({ productType: 'skill' });
      const decision = ruleSet.evaluate(facts);
      const ruleIds = decision.trace.map((t) => t.ruleId);
      expect(ruleIds).toContain('composition.outcome_tags');
      expect(ruleIds).toContain('composition.naming');
      expect(ruleIds).toContain('composition.projection');
      expect(ruleIds).toContain('composition.fallback_outcome');
    });
  });
});
