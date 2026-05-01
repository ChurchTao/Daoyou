import { describe, expect, it } from '@jest/globals';
import { AffixPoolBuilder } from '@/engine/creation-v2/affixes/AffixPoolBuilder';
import { AffixRegistry } from '@/engine/creation-v2/affixes/AffixRegistry';
import { DEFAULT_AFFIX_REGISTRY } from '@/engine/creation-v2/affixes';
import { CreationSession } from '@/engine/creation-v2/CreationSession';
import { CreationTags } from '@/engine/shared/tag-domain';
import { AffixDefinition } from '@/engine/creation-v2/affixes/types';
import { ELEMENT_TO_MATERIAL_TAG } from '@/engine/creation-v2/config/CreationMappings';
import { DefaultIntentResolver } from '@/engine/creation-v2/resolvers/DefaultIntentResolver';
import { AttributeType, BuffType, ModifierType, StackRule } from '../../contracts/battle';

describe('AffixPoolBuilder TargetPolicy 过滤测试', () => {
  const registry = new AffixRegistry();
  
  // 准备测试词缀
  const mockAffixes: AffixDefinition[] = [
    {
      id: 'skill-core-damage-test',
      displayName: '伤害词缀',
      displayDescription: '测试用',
      category: 'skill_core',
      rarity: 'common',
      match: { any: [CreationTags.MATERIAL.SEMANTIC_BLADE] },
      weight: 100,
      energyCost: 10,
      applicableTo: ['skill'],
      effectTemplate: { type: 'damage', params: { value: { base: 10 } } },
      targetPolicyConstraint: { team: 'enemy' } // 约束为敌方
    },
    {
      id: 'skill-core-heal-test',
      displayName: '治疗词缀',
      displayDescription: '测试用',
      category: 'skill_core',
      rarity: 'common',
      match: { any: [CreationTags.MATERIAL.SEMANTIC_SUSTAIN] },
      weight: 100,
      energyCost: 10,
      applicableTo: ['skill'],
      effectTemplate: { type: 'heal', params: { value: { base: 10 } } },
      targetPolicyConstraint: { team: 'self' } // 约束为自身
    },
    {
      id: 'skill-variant-generic-test',
      displayName: '通用变体',
      displayDescription: '测试用',
      category: 'skill_variant',
      rarity: 'common',
      match: { any: [CreationTags.MATERIAL.SEMANTIC_QI] },
      weight: 100,
      energyCost: 5,
      applicableTo: ['skill'],
      effectTemplate: { type: 'apply_buff', params: { buffConfig: { id: 'test', name: 'test', type: BuffType.BUFF, duration: 1, stackRule: StackRule.STACK_LAYER } } }
      // 无约束
    }
  ];

  registry.register(mockAffixes);
  const builder = new AffixPoolBuilder();

  it('当玩家意图为治疗自身时，应过滤掉敌方约束词缀', () => {
    const session = new CreationSession({
      sessionId: 'test-session',
      productType: 'skill',
      materials: [],
      requestedTargetPolicy: { team: 'self', scope: 'single' }
    });

    // 模拟匹配到标签
    session.syncInputTagSignals([
      { tag: CreationTags.MATERIAL.SEMANTIC_BLADE, source: 'material_semantic', weight: 1 },
      { tag: CreationTags.MATERIAL.SEMANTIC_SUSTAIN, source: 'material_semantic', weight: 1 },
      { tag: CreationTags.MATERIAL.SEMANTIC_QI, source: 'material_semantic', weight: 1 }
    ]);
    
    // 模拟配方匹配（解锁核心和变体）
    session.state.recipeMatch = {
      recipeId: 'test',
      valid: true,
      matchedTags: [],
      unlockedAffixCategories: ['skill_core', 'skill_variant']
    };

    // 解析意图
    const resolver = new DefaultIntentResolver();
    session.state.intent = resolver.resolve(session.state.input, []);

    const candidates = builder.build(registry, session);

    const ids = candidates.map(c => c.id);
    expect(ids).toContain('skill-core-heal-test');
    expect(ids).toContain('skill-variant-generic-test');
    expect(ids).not.toContain('skill-core-damage-test'); // 应被过滤
  });

  it('当玩家意图为攻击敌方时，应过滤掉自身约束词缀', () => {
    const session = new CreationSession({
      sessionId: 'test-session',
      productType: 'skill',
      materials: [],
      requestedTargetPolicy: { team: 'enemy', scope: 'single' }
    });

    session.syncInputTagSignals([
      { tag: CreationTags.MATERIAL.SEMANTIC_BLADE, source: 'material_semantic', weight: 1 },
      { tag: CreationTags.MATERIAL.SEMANTIC_SUSTAIN, source: 'material_semantic', weight: 1 }
    ]);
    
    session.state.recipeMatch = {
      recipeId: 'test',
      valid: true,
      matchedTags: [],
      unlockedAffixCategories: ['skill_core']
    };

    const resolver = new DefaultIntentResolver();
    session.state.intent = resolver.resolve(session.state.input, []);

    const candidates = builder.build(registry, session);

    const ids = candidates.map(c => c.id);
    expect(ids).toContain('skill-core-damage-test');
    expect(ids).not.toContain('skill-core-heal-test'); // 应被过滤
  });

  it('当词缀声明了 Scope 约束时，应进行过滤', () => {
    const aoeAffix: AffixDefinition = {
      id: 'skill-variant-aoe-only',
      displayName: '群体强化',
      displayDescription: '测试用',
      category: 'skill_variant',
      rarity: 'common',
      match: { any: [CreationTags.MATERIAL.SEMANTIC_BURST] },
      weight: 100,
      energyCost: 10,
      applicableTo: ['skill'],
      effectTemplate: { type: 'damage', params: { value: { base: 10 } } },
      targetPolicyConstraint: { scope: 'aoe' } // 仅限 AOE
    };
    
    const localRegistry = new AffixRegistry();
    localRegistry.register([...mockAffixes, aoeAffix]);

    // 1. 意图为 single
    const sessionSingle = new CreationSession({
      sessionId: 'test-single',
      productType: 'skill',
      materials: [],
      requestedTargetPolicy: { team: 'enemy', scope: 'single' }
    });
    sessionSingle.syncInputTagSignals([{ tag: CreationTags.MATERIAL.SEMANTIC_BURST, source: 'material_semantic', weight: 1 }]);
    sessionSingle.state.recipeMatch = { recipeId: 'test', valid: true, matchedTags: [], unlockedAffixCategories: ['skill_variant'] };
    sessionSingle.state.intent = new DefaultIntentResolver().resolve(sessionSingle.state.input, []);
    
    expect(builder.build(localRegistry, sessionSingle).map(c => c.id)).not.toContain('skill-variant-aoe-only');

    // 2. 意图为 aoe
    const sessionAoe = new CreationSession({
      sessionId: 'test-aoe',
      productType: 'skill',
      materials: [],
      requestedTargetPolicy: { team: 'enemy', scope: 'aoe' }
    });
    sessionAoe.syncInputTagSignals([{ tag: CreationTags.MATERIAL.SEMANTIC_BURST, source: 'material_semantic', weight: 1 }]);
    sessionAoe.state.recipeMatch = { recipeId: 'test', valid: true, matchedTags: [], unlockedAffixCategories: ['skill_variant'] };
    sessionAoe.state.intent = new DefaultIntentResolver().resolve(sessionAoe.state.input, []);

    expect(builder.build(localRegistry, sessionAoe).map(c => c.id)).toContain('skill-variant-aoe-only');
  });

  it('artifact requestedSlot 应过滤所有声明了 applicableArtifactSlots 的 category', () => {
    const artifactRegistry = new AffixRegistry();
    const artifactAffixes: AffixDefinition[] = [
      {
        id: 'artifact-core-weapon-test',
        displayName: '武器核心',
        displayDescription: '测试用',
        category: 'artifact_core',
        rarity: 'common',
        match: { any: [CreationTags.MATERIAL.SEMANTIC_GUARD] },
        weight: 100,
        energyCost: 10,
        applicableTo: ['artifact'],
        applicableArtifactSlots: ['weapon'],
        effectTemplate: {
          type: 'attribute_modifier',
          params: {
            attrType: AttributeType.ATK,
            modType: ModifierType.FIXED,
            value: 10,
          },
        },
      },
      {
        id: 'artifact-core-armor-test',
        displayName: '护甲核心',
        displayDescription: '测试用',
        category: 'artifact_core',
        rarity: 'common',
        match: { any: [CreationTags.MATERIAL.SEMANTIC_GUARD] },
        weight: 100,
        energyCost: 10,
        applicableTo: ['artifact'],
        applicableArtifactSlots: ['armor'],
        effectTemplate: {
          type: 'attribute_modifier',
          params: {
            attrType: AttributeType.DEF,
            modType: ModifierType.FIXED,
            value: 10,
          },
        },
      },
      {
        id: 'artifact-defense-weapon-only',
        displayName: '武器防御',
        displayDescription: '测试用',
        category: 'artifact_defense',
        rarity: 'common',
        match: { any: [CreationTags.MATERIAL.SEMANTIC_GUARD] },
        weight: 100,
        energyCost: 10,
        applicableTo: ['artifact'],
        applicableArtifactSlots: ['weapon'],
        effectTemplate: {
          type: 'attribute_modifier',
          params: {
            attrType: AttributeType.ACCURACY,
            modType: ModifierType.FIXED,
            value: 0.02,
          },
        },
      },
      {
        id: 'artifact-defense-armor-only',
        displayName: '护甲防御',
        displayDescription: '测试用',
        category: 'artifact_defense',
        rarity: 'common',
        match: { any: [CreationTags.MATERIAL.SEMANTIC_GUARD] },
        weight: 100,
        energyCost: 10,
        applicableTo: ['artifact'],
        applicableArtifactSlots: ['armor'],
        effectTemplate: {
          type: 'attribute_modifier',
          params: {
            attrType: AttributeType.CONTROL_RESISTANCE,
            modType: ModifierType.FIXED,
            value: 0.02,
          },
        },
      },
      {
        id: 'artifact-treasure-weapon-only',
        displayName: '武器珍宝',
        displayDescription: '测试用',
        category: 'artifact_treasure',
        rarity: 'rare',
        match: { any: [CreationTags.MATERIAL.SEMANTIC_GUARD] },
        weight: 100,
        energyCost: 10,
        applicableTo: ['artifact'],
        applicableArtifactSlots: ['weapon'],
        effectTemplate: {
          type: 'attribute_modifier',
          params: {
            attrType: AttributeType.CRIT_RATE,
            modType: ModifierType.FIXED,
            value: 0.02,
          },
        },
      },
      {
        id: 'artifact-treasure-armor-only',
        displayName: '护甲珍宝',
        displayDescription: '测试用',
        category: 'artifact_treasure',
        rarity: 'rare',
        match: { any: [CreationTags.MATERIAL.SEMANTIC_GUARD] },
        weight: 100,
        energyCost: 10,
        applicableTo: ['artifact'],
        applicableArtifactSlots: ['armor'],
        effectTemplate: {
          type: 'attribute_modifier',
          params: {
            attrType: AttributeType.HEAL_AMPLIFY,
            modType: ModifierType.FIXED,
            value: 0.02,
          },
        },
      },
    ];

    artifactRegistry.register(artifactAffixes);

    const session = new CreationSession({
      sessionId: 'artifact-slot-filter',
      productType: 'artifact',
      materials: [],
      requestedSlot: 'armor',
    });
    session.syncInputTagSignals([
      { tag: CreationTags.MATERIAL.SEMANTIC_GUARD, source: 'material_semantic', weight: 1 },
    ]);
    session.state.recipeMatch = {
      recipeId: 'artifact-test',
      valid: true,
      matchedTags: [],
      unlockedAffixCategories: ['artifact_core', 'artifact_defense', 'artifact_treasure'],
    };
    session.state.intent = new DefaultIntentResolver().resolve(session.state.input, []);

    const ids = builder.build(artifactRegistry, session).map((candidate) => candidate.id);

    expect(ids).toContain('artifact-core-armor-test');
    expect(ids).toContain('artifact-defense-armor-only');
    expect(ids).toContain('artifact-treasure-armor-only');
    expect(ids).not.toContain('artifact-core-weapon-test');
    expect(ids).not.toContain('artifact-defense-weapon-only');
    expect(ids).not.toContain('artifact-treasure-weapon-only');
  });

  it('冰系材料 + self 目标策略时，默认词缀库应仍能提供 self buff core', () => {
    const session = new CreationSession({
      sessionId: 'skill-ice-self-core',
      productType: 'skill',
      materials: [],
      requestedTargetPolicy: { team: 'self', scope: 'single' },
    });

    session.syncInputTagSignals([
      { tag: CreationTags.MATERIAL.SEMANTIC_FREEZE, source: 'material_semantic', weight: 1 },
      { tag: ELEMENT_TO_MATERIAL_TAG['冰'], source: 'material_semantic', weight: 1 },
    ]);
    session.state.recipeMatch = {
      recipeId: 'skill-test',
      valid: true,
      matchedTags: [],
      unlockedAffixCategories: ['skill_core', 'skill_variant'],
    };
    session.state.intent = new DefaultIntentResolver().resolve(session.state.input, []);

    const candidates = builder.build(DEFAULT_AFFIX_REGISTRY, session);
    const ids = candidates.filter((candidate) => candidate.category === 'skill_core').map((candidate) => candidate.id);

    expect(ids).toContain('skill-core-ice-frost-guard');
    expect(ids).not.toContain('skill-core-damage-ice');
  });

  it('八系元素在 self 目标策略下都应至少保留一个低阶 skill_core', () => {
    const canonicalSemanticByElement = {
      火: CreationTags.MATERIAL.SEMANTIC_FLAME,
      冰: CreationTags.MATERIAL.SEMANTIC_FREEZE,
      雷: CreationTags.MATERIAL.SEMANTIC_THUNDER,
      风: CreationTags.MATERIAL.SEMANTIC_WIND,
      金: CreationTags.MATERIAL.SEMANTIC_METAL,
      水: CreationTags.MATERIAL.SEMANTIC_WATER,
      木: CreationTags.MATERIAL.SEMANTIC_WOOD,
      土: CreationTags.MATERIAL.SEMANTIC_EARTH,
    } as const;

    for (const [element, semanticTag] of Object.entries(canonicalSemanticByElement) as Array<
      [keyof typeof canonicalSemanticByElement, string]
    >) {
      const session = new CreationSession({
        sessionId: `skill-${element}-self-core`,
        productType: 'skill',
        materials: [],
        requestedTargetPolicy: { team: 'self', scope: 'single' },
      });

      session.syncInputTagSignals([
        { tag: semanticTag, source: 'material_semantic', weight: 1 },
        { tag: ELEMENT_TO_MATERIAL_TAG[element], source: 'material_semantic', weight: 1 },
      ]);
      session.state.recipeMatch = {
        recipeId: 'skill-test',
        valid: true,
        matchedTags: [],
        unlockedAffixCategories: ['skill_core'],
      };
      session.state.intent = new DefaultIntentResolver().resolve(session.state.input, []);

      const coreIds = builder
        .build(DEFAULT_AFFIX_REGISTRY, session)
        .filter((candidate) => candidate.category === 'skill_core')
        .map((candidate) => candidate.id);

      expect(coreIds.length).toBeGreaterThan(0);
    }
  });

  it('水系特材 + self 目标策略 + rare 解锁时，应转向 self skill_rare 而非 enemy rare', () => {
    const session = new CreationSession({
      sessionId: 'skill-water-self-rare',
      productType: 'skill',
      materials: [],
      requestedTargetPolicy: { team: 'self', scope: 'single' },
    });

    session.syncInputTagSignals([
      { tag: CreationTags.MATERIAL.SEMANTIC_WATER, source: 'material_semantic', weight: 1 },
      { tag: CreationTags.MATERIAL.SEMANTIC_SPIRIT, source: 'material_semantic', weight: 1 },
      { tag: CreationTags.MATERIAL.TYPE_SPECIAL, source: 'material_semantic', weight: 1 },
      { tag: ELEMENT_TO_MATERIAL_TAG['水'], source: 'material_semantic', weight: 1 },
    ]);
    session.state.materialFingerprints = [
      {
        rank: '玄品',
        energyValue: 34,
        rarityWeight: 6,
        explicitTags: [CreationTags.MATERIAL.TYPE_SPECIAL, ELEMENT_TO_MATERIAL_TAG['水']],
        semanticTags: [
          CreationTags.MATERIAL.SEMANTIC_WATER,
          CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        ],
        recipeTags: [CreationTags.RECIPE.PRODUCT_BIAS_SKILL],
        materialName: '玄潮灵核',
        materialType: 'tcdb',
        quantity: 1,
        element: '水',
      },
    ];
    session.state.recipeMatch = {
      recipeId: 'skill-test',
      valid: true,
      matchedTags: [],
      unlockedAffixCategories: ['skill_core', 'skill_variant', 'skill_rare'],
    };
    session.state.intent = new DefaultIntentResolver().resolve(session.state.input, []);

    const ids = builder
      .build(DEFAULT_AFFIX_REGISTRY, session)
      .filter((candidate) => candidate.category === 'skill_rare')
      .map((candidate) => candidate.id);

    expect(ids).toContain('skill-rare-water-purifying-tide');
    expect(ids).not.toContain('skill-rare-tide-collapse');
  });
});
