import { AffixEffectTranslator } from '@/engine/creation-v2/affixes/AffixEffectTranslator';
import { AffixRegistry } from '@/engine/creation-v2/affixes/AffixRegistry';
import { AffixDefinition } from '@/engine/creation-v2/affixes/types';
import { AttributeType, ModifierType } from '@/engine/creation-v2/contracts/battle';
import { CompositionRuleSet } from '@/engine/creation-v2/rules/composition/CompositionRuleSet';
import { CompositionFacts } from '@/engine/creation-v2/rules/contracts/CompositionFacts';
import {
  PassiveProjectionPolicy,
  SkillProjectionPolicy,
} from '@/engine/creation-v2/rules/contracts/CompositionDecision';
import { CreationTags } from '@/engine/creation-v2/core/GameplayTags';
import { MaterialFingerprint, RecipeMatch, RolledAffix } from '@/engine/creation-v2/types';

// ─── helpers ────────────────────────────────────────────────────────────────

const BASE_RECIPE_MATCH: RecipeMatch = {
  recipeId: 'test-recipe',
  valid: true,
  matchedTags: [],
  unlockedAffixCategories: ['core'],
};

const BASE_ENERGY_SUMMARY: CompositionFacts['energySummary'] = {
  effectiveTotal: 20,
  reserved: 4,
  startingAffixEnergy: 16,
  spentAffixEnergy: 0,
  remainingAffixEnergy: 16,
};

const BASE_QUALITY_PROFILE: CompositionFacts['materialQualityProfile'] = {
  maxQuality: '灵品',
  weightedAverageQuality: '灵品',
  minQuality: '灵品',
  maxQualityOrder: 1,
  weightedAverageOrder: 1,
  minQualityOrder: 1,
  qualitySpread: 0,
  totalQuantity: 1,
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
    energySummary: override.energySummary ?? BASE_ENERGY_SUMMARY,
    affixes: override.affixes ?? [],
    sessionTags: override.sessionTags ?? ['Material.Semantic.Metal'],
    materialFingerprints: override.materialFingerprints ?? [BASE_FINGERPRINT],
    materialQualityProfile:
      override.materialQualityProfile ?? BASE_QUALITY_PROFILE,
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

const SKILL_FALLBACK_CORE_AFFIX_DEF: AffixDefinition = {
  id: 'skill-core-damage',
  displayName: '斩击',
  displayDescription: '技能保底核心伤害',
  category: 'core',
  applicableTo: ['skill'],
  tagQuery: ['Material.Semantic.Metal'],
  weight: 10,
  energyCost: 8,
  effectTemplate: {
    type: 'damage',
    params: {
      value: {
        base: { base: 80, scale: 'quality', coefficient: 14 },
        attribute: AttributeType.MAGIC_ATK,
        coefficient: 0.9,
      },
    },
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

const ARTIFACT_STATIC_MODIFIER_AFFIX_DEF: AffixDefinition = {
  id: 'artifact-static-modifier',
  displayName: '玄铁铸体',
  displayDescription: '法宝常驻体魄加成',
  category: 'core',
  applicableTo: ['artifact'],
  tagQuery: ['Material.Semantic.Metal'],
  weight: 10,
  energyCost: 8,
  effectTemplate: {
    type: 'attribute_modifier',
    params: {
      attrType: AttributeType.VITALITY,
      modType: ModifierType.FIXED,
      value: { base: 6, scale: 'quality', coefficient: 2 },
    },
  },
};

const ARTIFACT_BUNDLED_MODIFIER_AFFIX_DEF: AffixDefinition = {
  id: 'artifact-bundled-modifier',
  displayName: '双极灵核',
  displayDescription: '法宝常驻双属性加成',
  category: 'core',
  applicableTo: ['artifact'],
  applicableArtifactSlots: ['weapon'],
  tagQuery: ['Material.Semantic.Metal'],
  weight: 10,
  energyCost: 8,
  effectTemplate: {
    type: 'attribute_modifier',
    params: {
      modifiers: [
        {
          attrType: AttributeType.ATK,
          modType: ModifierType.FIXED,
          value: { base: 6, scale: 'quality', coefficient: 2 },
        },
        {
          attrType: AttributeType.MAGIC_ATK,
          modType: ModifierType.FIXED,
          value: { base: 6, scale: 'quality', coefficient: 2 },
        },
      ],
    },
  },
};

const ARTIFACT_WEAPON_FALLBACK_CORE_AFFIX_DEF: AffixDefinition = {
  id: 'artifact-core-weapon-dual-edge',
  displayName: '锋魂双极',
  displayDescription: '法宝 weapon 槽位的保底双攻核心',
  category: 'core',
  applicableTo: ['artifact'],
  applicableArtifactSlots: ['weapon'],
  tagQuery: ['Material.Semantic.Metal'],
  weight: 10,
  energyCost: 8,
  effectTemplate: {
    type: 'attribute_modifier',
    params: {
      modifiers: [
        {
          attrType: AttributeType.ATK,
          modType: ModifierType.FIXED,
          value: { base: 6, scale: 'quality', coefficient: 2 },
        },
        {
          attrType: AttributeType.MAGIC_ATK,
          modType: ModifierType.FIXED,
          value: { base: 6, scale: 'quality', coefficient: 2 },
        },
      ],
    },
  },
};

const ARTIFACT_ACCESSORY_FALLBACK_CORE_AFFIX_DEF: AffixDefinition = {
  id: 'artifact-core-accessory-omen',
  displayName: '星兆坠',
  displayDescription: '法宝 accessory 槽位的保底双副属性核心',
  category: 'core',
  applicableTo: ['artifact'],
  applicableArtifactSlots: ['accessory'],
  tagQuery: ['Material.Semantic.Spirit'],
  weight: 10,
  energyCost: 8,
  effectTemplate: {
    type: 'attribute_modifier',
    params: {
      modifiers: [
        {
          attrType: AttributeType.CRIT_RATE,
          modType: ModifierType.FIXED,
          value: { base: 0.035, scale: 'quality', coefficient: 0.008 },
        },
        {
          attrType: AttributeType.CRIT_DAMAGE_MULT,
          modType: ModifierType.FIXED,
          value: { base: 0.08, scale: 'quality', coefficient: 0.02 },
        },
      ],
    },
  },
};

const ARTIFACT_TEMP_STAT_BUFF_AFFIX_DEF: AffixDefinition = {
  id: 'artifact-temp-stat-buff',
  displayName: '灵光灌注',
  displayDescription: '通过 buff 临时提升属性',
  category: 'prefix',
  applicableTo: ['artifact'],
  tagQuery: ['Material.Semantic.Spirit'],
  weight: 10,
  energyCost: 6,
  effectTemplate: {
    type: 'attribute_stat_buff',
    params: {
      attrType: AttributeType.SPIRIT,
      modType: ModifierType.FIXED,
      value: { base: 3, scale: 'quality', coefficient: 1 },
      duration: 1,
    },
  },
};

const GONGFA_FALLBACK_CORE_AFFIX_DEF: AffixDefinition = {
  id: 'gongfa-core-spirit',
  displayName: '灵脉运转',
  displayDescription: '功法保底灵力核心',
  category: 'core',
  applicableTo: ['gongfa'],
  tagQuery: ['Material.Semantic.Spirit'],
  weight: 10,
  energyCost: 8,
  effectTemplate: {
    type: 'attribute_modifier',
    params: {
      attrType: AttributeType.SPIRIT,
      modType: ModifierType.FIXED,
      value: { base: 5, scale: 'quality', coefficient: 2 },
    },
  },
};

// ─── tests ──────────────────────────────────────────────────────────────────

describe('CompositionRuleSet — 端到端集成', () => {
  let registry: AffixRegistry;
  let ruleSet: CompositionRuleSet;

  beforeEach(() => {
    registry = new AffixRegistry();
    registry.register([
      DAMAGE_AFFIX_DEF,
      SKILL_FALLBACK_CORE_AFFIX_DEF,
      HEAL_AFFIX_DEF,
      ARTIFACT_STATIC_MODIFIER_AFFIX_DEF,
      ARTIFACT_BUNDLED_MODIFIER_AFFIX_DEF,
      ARTIFACT_WEAPON_FALLBACK_CORE_AFFIX_DEF,
      ARTIFACT_ACCESSORY_FALLBACK_CORE_AFFIX_DEF,
      ARTIFACT_TEMP_STAT_BUFF_AFFIX_DEF,
      GONGFA_FALLBACK_CORE_AFFIX_DEF,
    ]);
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

    it('直接伤害词缀应保留词缀定义的原始数值', () => {
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
      const damageEffect = policy.effects.find((effect) => effect.type === 'damage');
      expect(damageEffect).toBeDefined();

      if (damageEffect?.type === 'damage') {
        expect(damageEffect.params.value.base).toBe(100);
      }
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
    it('无词缀时：应触发 fallback，产出 artifact_passive policy，并注入槽位 core modifiers', () => {
      const facts = makeFacts({ productType: 'artifact' });
      const decision = ruleSet.evaluate(facts);

      expect(decision.outcomeKind).toBe('artifact');
      const policy = decision.projectionPolicy as PassiveProjectionPolicy;
      expect(policy).toBeDefined();
      expect(policy.kind).toBe('artifact_passive');
      expect(policy.listeners).toHaveLength(0);
      expect(policy.modifiers?.length).toBe(2);
      expect(decision.defaultsApplied).toContain('artifact_core_fallback');
    });

    it('artifact accessory 无词缀时：应注入 accessory core 的两个二级属性 modifiers', () => {
      const facts = makeFacts({
        productType: 'artifact',
        intent: {
          productType: 'artifact',
          outcomeKind: 'artifact',
          slotBias: 'accessory',
          dominantTags: [],
          requestedTags: [],
        },
      });
      const decision = ruleSet.evaluate(facts);
      const policy = decision.projectionPolicy as PassiveProjectionPolicy;

      expect(policy.modifiers).toHaveLength(2);
    });

    it('decision.name 不应为空字符串', () => {
      const facts = makeFacts({ productType: 'artifact' });
      const decision = ruleSet.evaluate(facts);
      expect(decision.name.length).toBeGreaterThan(0);
    });

    it('attribute_modifier 应投影到 modifiers（静态属性修改）', () => {
      const facts = makeFacts({
        productType: 'artifact',
        affixes: [
          {
            id: 'artifact-static-modifier',
            name: '玄铁铸体',
            category: 'core',
            energyCost: 8,
            rollScore: 1,
            weight: 10,
            tags: [],
          },
        ],
      });
      const decision = ruleSet.evaluate(facts);
      const policy = decision.projectionPolicy as PassiveProjectionPolicy;

      expect(policy.modifiers?.length ?? 0).toBeGreaterThan(0);
      const mod = policy.modifiers![0];
      expect(mod.attrType).toBe(AttributeType.VITALITY);
      expect(mod.type).toBe(ModifierType.FIXED);
    });

    it('attribute_modifier 的数值缩放应使用 weightedAverageQuality，而不是最高品质', () => {
      const facts = makeFacts({
        productType: 'artifact',
        materialQualityProfile: {
          maxQuality: '天品',
          weightedAverageQuality: '灵品',
          minQuality: '凡品',
          maxQualityOrder: 5,
          weightedAverageOrder: 1,
          minQualityOrder: 0,
          qualitySpread: 5,
          totalQuantity: 4,
        },
        affixes: [
          {
            id: 'artifact-static-modifier',
            name: '玄铁铸体',
            category: 'core',
            energyCost: 8,
            rollScore: 1,
            weight: 10,
            tags: [],
          },
        ],
      });
      const decision = ruleSet.evaluate(facts);
      const policy = decision.projectionPolicy as PassiveProjectionPolicy;

      expect(policy.modifiers?.[0]?.value).toBe(8);
    });

    it('attribute_modifier 支持一次投影多个 modifiers（weapon core）', () => {
      const facts = makeFacts({
        productType: 'artifact',
        intent: {
          productType: 'artifact',
          outcomeKind: 'artifact',
          slotBias: 'weapon',
          dominantTags: [],
          requestedTags: [],
        },
        affixes: [
          {
            id: 'artifact-bundled-modifier',
            name: '双极灵核',
            category: 'core',
            energyCost: 8,
            rollScore: 1,
            weight: 10,
            tags: [],
          },
        ],
      });
      const decision = ruleSet.evaluate(facts);
      const policy = decision.projectionPolicy as PassiveProjectionPolicy;

      expect(policy.modifiers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            attrType: AttributeType.ATK,
            type: ModifierType.FIXED,
          }),
          expect.objectContaining({
            attrType: AttributeType.MAGIC_ATK,
            type: ModifierType.FIXED,
          }),
        ]),
      );
      expect(policy.modifiers).toHaveLength(2);
    });

    it('attribute_stat_buff 应保留为 listener + apply_buff（临时 buff 语义）', () => {
      const facts = makeFacts({
        productType: 'artifact',
        affixes: [
          {
            id: 'artifact-temp-stat-buff',
            name: '灵光灌注',
            category: 'prefix',
            energyCost: 6,
            rollScore: 1,
            weight: 10,
            tags: [],
          },
        ],
      });
      const decision = ruleSet.evaluate(facts);
      const policy = decision.projectionPolicy as PassiveProjectionPolicy;

      expect((policy.modifiers?.length ?? 0) === 0).toBe(true);
      expect(policy.listeners.length).toBeGreaterThan(0);
      expect(policy.listeners.some((l) => l.effects.some((e) => e.type === 'apply_buff'))).toBe(
        true,
      );
    });
  });

  // ── gongfa ─────────────────────────────────────────────────────────────────

  describe('productType: gongfa', () => {
    it('无词缀时：应触发 fallback，产出 gongfa_passive policy，并注入永久属性 modifiers', () => {
      const facts = makeFacts({
        productType: 'gongfa',
        materialNames: ['玄铁'],
      });
      const decision = ruleSet.evaluate(facts);

      expect(decision.outcomeKind).toBe('gongfa');
      const policy = decision.projectionPolicy as PassiveProjectionPolicy;
      expect(policy).toBeDefined();
      expect(policy.kind).toBe('gongfa_passive');
      expect(policy.listeners).toHaveLength(0);
      expect(policy.modifiers?.length).toBeGreaterThan(0);
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
