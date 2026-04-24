import { describe, expect, it } from '@jest/globals';
import { AffixPoolBuilder } from '@/engine/creation-v2/affixes/AffixPoolBuilder';
import { AffixRegistry } from '@/engine/creation-v2/affixes/AffixRegistry';
import { CreationSession } from '@/engine/creation-v2/CreationSession';
import { CreationTags } from '@/engine/shared/tag-domain';
import { AffixDefinition } from '@/engine/creation-v2/affixes/types';
import { DefaultIntentResolver } from '@/engine/creation-v2/resolvers/DefaultIntentResolver';
import { BuffType, StackRule } from '../../contracts/battle';

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
});
