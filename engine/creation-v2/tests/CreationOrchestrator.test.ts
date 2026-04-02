import { Ability, AbilityType } from '@/engine/creation-v2/contracts/battle';
import { projectAbilityConfig } from '../models';
import { CreationOutcomeMaterializer } from '../adapters/types';
import { CreationOrchestrator } from '../CreationOrchestrator';
import { CraftFailedEvent } from '../core/events';
import { CreationTags } from '../core/GameplayTags';
import { CreationEventPriorityLevel } from '../core/types';
import { CreationBlueprint, EnergyBudget, MaterialFingerprint, RecipeMatch } from '../types';

describe('CreationOrchestrator', () => {
  it('应支持从材料样本走到默认 blueprint', () => {
    const orchestrator = new CreationOrchestrator();
    const session = orchestrator.createSession({
      sessionId: 'session-e2e',
      productType: 'skill',
      materials: [
        {
          id: 'mat-a',
          name: '赤炎精铁',
          type: 'ore',
          rank: '玄品',
          quantity: 2,
          element: '火',
          description: '蕴含火行意象与锋锐之气',
        },
        {
          id: 'mat-b',
          name: '雷髓碎晶',
          type: 'monster',
          rank: '灵品',
          quantity: 1,
          element: '雷',
          description: '碎晶中残留雷霆爆裂之意',
        },
      ],
      requestedTags: ['Material.Semantic.Flame'],
    });

    orchestrator.submitMaterials(session);
    const fingerprints = orchestrator.analyzeMaterialsWithDefaults(session);
    const intent = orchestrator.resolveIntentWithDefaults(session);
    const recipeMatch = orchestrator.validateRecipeWithDefaults(session);
    const budget = orchestrator.budgetEnergyWithDefaults(session);
    const blueprint = orchestrator.composeBlueprintWithDefaults(session);

    expect(fingerprints[0].semanticTags).toContain('Material.Semantic.Flame');
    expect(intent.outcomeKind).toBe('active_skill');
    expect(recipeMatch.valid).toBe(true);
    expect(budget.total).toBeGreaterThan(0);
    expect(blueprint.abilityConfig.type).toBe(AbilityType.ACTIVE_SKILL);
    expect(blueprint.productModel.tags).toContain('Ability.Type.Damage');
  });

  it('应能将主动技能蓝图物化为 battle-v5 主动技能能力实例', () => {
    const orchestrator = new CreationOrchestrator();
    const order: string[] = [];

    orchestrator.eventBus.subscribe(
      'MaterialSubmittedEvent',
      () => order.push('submitted'),
      CreationEventPriorityLevel.INTENT_ANALYSIS,
    );
    orchestrator.eventBus.subscribe(
      'OutcomeMaterializedEvent',
      () => order.push('materialized'),
      CreationEventPriorityLevel.MATERIALIZATION,
    );

    const session = orchestrator.createSession({
      sessionId: 'session-active',
      productType: 'skill',
      materials: [
        {
          id: 'mat-1',
          name: '赤炎精铁',
          type: 'ore',
          rank: '玄品',
          quantity: 2,
          element: '火',
          description: '蕴含烈焰意象的矿石',
        },
      ],
      requestedTags: ['Material.Semantic.Flame'],
    });

    const fingerprints: MaterialFingerprint[] = [
      {
        materialId: 'mat-1',
        materialName: '赤炎精铁',
        materialType: 'ore',
        rank: '玄品',
        quantity: 2,
        explicitTags: ['Material.Type.Ore', 'Material.Element.Fire'],
        semanticTags: ['Material.Semantic.Flame'],
        recipeTags: ['Recipe.Crafter.Weapon'],
        energyValue: 24,
        rarityWeight: 2,
        element: '火',
      },
    ];
    const recipeMatch: RecipeMatch = {
      recipeId: 'skill-fire-core',
      valid: true,
      matchedTags: ['Recipe.Matched.Fire'],
      unlockedAffixCategories: ['core', 'prefix'],
      reservedEnergy: 8,
    };
    const budget: EnergyBudget = {
      total: 24,
      reserved: 8,
      spent: 0,
      remaining: 16,
      initialRemaining: 16,
      allocations: [],
      rejections: [],
      sources: [{ source: '赤炎精铁', amount: 24 }],
    };
    const blueprint: CreationBlueprint = {
      outcomeKind: 'active_skill',
      productModel: {
        productType: 'skill',
        outcomeKind: 'active_skill',
        slug: 'craft-skill-session-active',
        name: '焚岳诀',
        description: '将烈焰压缩成一线，瞬间焚穿敌躯。',
        tags: ['Outcome.ActiveSkill', 'Ability.Element.Fire'],
        affixes: [
          {
            id: 'core-flame-burst',
            name: '炎爆核心',
            category: 'core',
            tags: ['offensive', 'fire'],
            weight: 10,
            energyCost: 8,
            rollScore: 0.91,
          },
        ],
        abilityTags: ['Ability.Type.Damage', 'Ability.Element.Fire'],
        battleProjection: {
          projectionKind: 'active_skill',
          abilityTags: ['Ability.Type.Damage', 'Ability.Element.Fire'],
          mpCost: 18,
          cooldown: 2,
          priority: 12,
          targetPolicy: {
            team: 'enemy',
            scope: 'single',
          },
          effects: [
            {
              type: 'damage',
              params: {
                value: {
                  base: 24,
                  coefficient: 0.8,
                },
              },
            },
          ],
        },
      },
      abilityConfig: {
        slug: 'craft-skill-session-active',
        name: '焚岳诀',
        type: AbilityType.ACTIVE_SKILL,
        tags: ['Ability.Type.Damage', 'Ability.Element.Fire'],
        mpCost: 18,
        cooldown: 2,
        priority: 12,
        targetPolicy: {
          team: 'enemy',
          scope: 'single',
        },
        effects: [
          {
            type: 'damage',
            params: {
              value: {
                base: 24,
                coefficient: 0.8,
              },
            },
          },
        ],
      },
    };
    blueprint.abilityConfig = projectAbilityConfig(blueprint.productModel);

    orchestrator.submitMaterials(session);
    orchestrator.recordMaterialAnalysis(session, fingerprints);
    orchestrator.resolveIntent(session, {
      productType: 'skill',
      outcomeKind: 'active_skill',
      dominantTags: ['fire', 'burst'],
      requestedTags: ['fire'],
      elementBias: '火',
    });
    orchestrator.validateRecipe(session, recipeMatch);
    orchestrator.budgetEnergy(session, budget);
    orchestrator.buildAffixPool(session, blueprint.productModel.affixes);
    orchestrator.rollAffixes(session, blueprint.productModel.affixes);
    orchestrator.composeBlueprint(session, blueprint);

    const outcome = orchestrator.materializeOutcome(session);

    expect(order).toEqual(['submitted', 'materialized']);
    expect(outcome.ability.type).toBe(AbilityType.ACTIVE_SKILL);
    expect(outcome.ability.name).toBe('焚岳诀');
    expect(session.state.tags).toContain('Material.Semantic.Flame');
  });

  it('应能将 artifact 蓝图物化为 battle-v5 被动能力实例', () => {
    const orchestrator = new CreationOrchestrator();
    const session = orchestrator.createSession({
      sessionId: 'session-passive',
      productType: 'artifact',
      materials: [
        {
          id: 'mat-2',
          name: '玄冰魄玉',
          type: 'ore',
          rank: '真品',
          quantity: 1,
          element: '冰',
        },
      ],
    });

    orchestrator.recordMaterialAnalysis(session, [
      {
        materialId: 'mat-2',
        materialName: '玄冰魄玉',
        materialType: 'ore',
        rank: '真品',
        quantity: 1,
        explicitTags: ['Material.Type.Ore', 'Material.Element.Ice'],
        semanticTags: ['Material.Semantic.Freeze'],
        recipeTags: ['Recipe.Crafter.Artifact'],
        energyValue: 30,
        rarityWeight: 3,
        element: '冰',
      },
    ]);
    orchestrator.resolveIntent(session, {
      productType: 'artifact',
      outcomeKind: 'artifact',
      dominantTags: ['ice', 'defensive'],
      requestedTags: ['shield'],
      elementBias: '冰',
    });
    orchestrator.composeBlueprint(session, {
      outcomeKind: 'artifact',
      productModel: {
        productType: 'artifact',
        outcomeKind: 'artifact',
        slug: 'craft-passive-session-passive',
        name: '玄冰护心佩',
        description: '寒意护体，遇袭时凝结冰盾。',
        tags: ['Outcome.PassiveAbility', 'Ability.Element.Ice'],
        affixes: [],
        abilityTags: ['Ability.Element.Ice'],
        equipPolicy: 'single_slot',
        persistencePolicy: 'inventory_bound',
        progressionPolicy: 'reforgeable',
        artifactConfig: {
          equipPolicy: 'single_slot',
          persistencePolicy: 'inventory_bound',
          progressionPolicy: 'reforgeable',
        },
        battleProjection: {
          projectionKind: 'artifact_passive',
          abilityTags: ['Ability.Element.Ice'],
          listeners: [
            {
              eventType: CreationTags.BATTLE_EVENT.DAMAGE_TAKEN,
              scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
              priority: 50,
              effects: [
                {
                  type: 'shield',
                  params: {
                    value: {
                      base: 12,
                      coefficient: 0.4,
                    },
                  },
                },
              ],
            },
          ],
        },
      },
      name: '玄冰护心佩',
      description: '寒意护体，遇袭时凝结冰盾。',
      tags: ['Outcome.PassiveAbility', 'Ability.Element.Ice'],
      affixes: [],
      abilityConfig: {
        slug: 'craft-passive-session-passive',
        name: '玄冰护心佩',
        type: AbilityType.PASSIVE_SKILL,
        tags: ['Ability.Element.Ice'],
        listeners: [
          {
            eventType: CreationTags.BATTLE_EVENT.DAMAGE_TAKEN,
            scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
            priority: 50,
            effects: [
              {
                type: 'shield',
                params: {
                  value: {
                    base: 12,
                    coefficient: 0.4,
                  },
                },
              },
            ],
          },
        ],
      },
    });

    const outcome = orchestrator.materializeOutcome(session);

    expect(outcome.ability.type).toBe(AbilityType.PASSIVE_SKILL);
    expect(outcome.ability.name).toBe('玄冰护心佩');
    expect(outcome.blueprint.productModel.productType).toBe('artifact');
  });

  it('应拒绝火冰材料混炉', () => {
    const orchestrator = new CreationOrchestrator();
    const session = orchestrator.createSession({
      sessionId: 'session-conflict',
      productType: 'skill',
      materials: [
        {
          id: 'mat-fire',
          name: '离火砂',
          type: 'ore',
          rank: '灵品',
          quantity: 1,
          element: '火',
        },
        {
          id: 'mat-ice',
          name: '玄冰魄',
          type: 'monster',
          rank: '灵品',
          quantity: 1,
          element: '冰',
        },
      ],
    });

    orchestrator.analyzeMaterialsWithDefaults(session);
    orchestrator.resolveIntentWithDefaults(session);
    const recipeMatch = orchestrator.validateRecipeWithDefaults(session);

    expect(recipeMatch.valid).toBe(false);
    expect(session.state.phase).toBe('failed');
    expect(session.state.failureReason).toContain('火、冰材料');
  });

  it('CraftFailedEvent 应保留失败发生时的原始 phase', () => {
    const orchestrator = new CreationOrchestrator();
    const phases: string[] = [];
    const session = orchestrator.createSession({
      sessionId: 'session-failed-phase',
      productType: 'skill',
      materials: [],
    });

    session.setPhase('recipe_validated' as never);
    orchestrator.eventBus.subscribe<CraftFailedEvent>('CraftFailedEvent', (event) => {
      phases.push(event.phase);
    });

    orchestrator.fail(session, '配方失败');

    expect(phases).toEqual(['recipe_validated']);
    expect(session.state.phase).toBe('failed');
  });

  it('应拒绝未知 productType 的会话创建', () => {
    const orchestrator = new CreationOrchestrator();

    expect(() =>
      orchestrator.createSession({
        productType: 'unknown' as never,
        materials: [],
      }),
    ).toThrow('Unsupported creation product type: unknown');
  });

  it('应拒绝在 intent 解析前校验配方', () => {
    const orchestrator = new CreationOrchestrator();
    const session = orchestrator.createSession({
      sessionId: 'session-no-intent-for-recipe',
      productType: 'skill',
      materials: [],
    });

    expect(() => orchestrator.validateRecipeWithDefaults(session)).toThrow(
      'Cannot validate recipe before resolving intent',
    );
  });

  it('应拒绝在 intent 解析前抽取词缀', () => {
    const orchestrator = new CreationOrchestrator();
    const session = orchestrator.createSession({
      sessionId: 'session-no-intent-for-affix-roll',
      productType: 'skill',
      materials: [],
    });

    expect(() => orchestrator.rollAffixesWithDefaults(session)).toThrow(
      'Cannot roll affixes before resolving intent',
    );
  });

  it('应拒绝在能量预算前抽取词缀', () => {
    const orchestrator = new CreationOrchestrator();
    const session = orchestrator.createSession({
      sessionId: 'session-no-budget-for-affix-roll',
      productType: 'skill',
      materials: [],
    });

    orchestrator.resolveIntent(session, {
      productType: 'skill',
      outcomeKind: 'active_skill',
      dominantTags: ['Outcome.ActiveSkill'],
      requestedTags: [],
    });

    expect(() => orchestrator.rollAffixesWithDefaults(session)).toThrow(
      'Cannot roll affixes before energy budgeting',
    );
  });

  it('应拒绝在蓝图生成前物化 outcome', () => {
    const orchestrator = new CreationOrchestrator();
    const session = orchestrator.createSession({
      sessionId: 'session-no-blueprint-for-materialize',
      productType: 'skill',
      materials: [],
    });

    expect(() => orchestrator.materializeOutcome(session)).toThrow(
      'Cannot materialize outcome before blueprint is composed',
    );
  });

  it('应拒绝在物化前持久化 outcome', () => {
    const orchestrator = new CreationOrchestrator();
    const session = orchestrator.createSession({
      sessionId: 'session-no-outcome-for-persist',
      productType: 'skill',
      materials: [],
    });

    expect(() => orchestrator.markPersisted(session)).toThrow(
      'Cannot persist outcome before materialization',
    );
  });

  it('应在词缀抽取后回写能量消耗与剩余能量', () => {
    const orchestrator = new CreationOrchestrator();
    const session = orchestrator.createSession({
      sessionId: 'session-energy-budget',
      productType: 'skill',
      materials: [],
    });

    orchestrator.budgetEnergy(session, {
      total: 30,
      reserved: 6,
      spent: 0,
      remaining: 24,
      initialRemaining: 24,
      allocations: [],
      rejections: [],
      sources: [{ source: '测试材料', amount: 30 }],
    });

    orchestrator.rollAffixes(session, [
      {
        id: 'skill-core-damage',
        name: '斩击',
        category: 'core',
        tags: ['Material.Semantic.Blade'],
        weight: 80,
        energyCost: 8,
        rollScore: 1,
      },
      {
        id: 'skill-prefix-crit-boost',
        name: '锋锐',
        category: 'prefix',
        tags: ['Material.Semantic.Blade'],
        weight: 60,
        energyCost: 6,
        rollScore: 0.75,
      },
    ]);

    expect(session.state.energyBudget).toMatchObject({
      total: 30,
      reserved: 6,
      spent: 14,
      remaining: 10,
      allocations: [
        { affixId: 'skill-core-damage', amount: 8 },
        { affixId: 'skill-prefix-crit-boost', amount: 6 },
      ],
    });
  });

  it('应允许通过抽象 materializer 物化 outcome', () => {
    const orchestrator = new CreationOrchestrator();
    const session = orchestrator.createSession({
      sessionId: 'session-materializer-abstraction',
      productType: 'skill',
      materials: [],
    });

    const blueprint: CreationBlueprint = {
      outcomeKind: 'active_skill',
      productModel: {
        productType: 'skill',
        outcomeKind: 'active_skill',
        slug: 'test-abstract-materializer',
        name: '测试造物',
        description: '抽象物化器测试',
        tags: ['Outcome.ActiveSkill'],
        affixes: [],
        abilityTags: ['Ability.Type.Damage'],
        battleProjection: {
          projectionKind: 'active_skill',
          abilityTags: ['Ability.Type.Damage'],
          mpCost: 10,
          cooldown: 1,
          priority: 10,
          targetPolicy: {
            team: 'enemy',
            scope: 'single',
          },
          effects: [
            {
              type: 'damage',
              params: {
                value: {
                  base: 10,
                },
              },
            },
          ],
        },
      },
      abilityConfig: {
        slug: 'test-abstract-materializer',
        name: '测试造物',
        type: AbilityType.ACTIVE_SKILL,
        tags: ['Ability.Type.Damage'],
        mpCost: 10,
        cooldown: 1,
        priority: 10,
        targetPolicy: {
          team: 'enemy',
          scope: 'single',
        },
        effects: [
          {
            type: 'damage',
            params: {
              value: {
                base: 10,
              },
            },
          },
        ],
      },
      name: '测试造物',
      description: '抽象物化器测试',
      tags: ['Outcome.ActiveSkill'],
      affixes: [],
    };

    orchestrator.composeBlueprint(session, blueprint);

    const stubMaterializer: CreationOutcomeMaterializer = {
      materialize(_productType, inputBlueprint) {
        return {
          blueprint: inputBlueprint,
          ability: {
            type: AbilityType.ACTIVE_SKILL,
            name: inputBlueprint.productModel.name,
          } as Ability,
        };
      },
    };

    const outcome = orchestrator.materializeOutcomeWith(session, stubMaterializer);

    expect(outcome.blueprint.productModel.productType).toBe('skill');
    expect(outcome.ability.name).toBe('测试造物');
  });

  it('应通过阶段 handler 自动推进 event-driven workflow 到 materialized', () => {
    const orchestrator = new CreationOrchestrator();
    const order: string[] = [];

    [
      'MaterialSubmittedEvent',
      'MaterialAnalyzedEvent',
      'IntentResolvedEvent',
      'RecipeValidatedEvent',
      'EnergyBudgetedEvent',
      'AffixPoolBuiltEvent',
      'AffixRolledEvent',
      'BlueprintComposedEvent',
      'OutcomeMaterializedEvent',
    ].forEach((eventType) => {
      orchestrator.eventBus.subscribe(eventType, () => order.push(eventType));
    });

    const session = orchestrator.createSession({
      sessionId: 'session-event-driven-success',
      productType: 'skill',
      materials: [
        {
          id: 'mat-a',
          name: '赤炎精铁',
          type: 'ore',
          rank: '玄品',
          quantity: 2,
          element: '火',
          description: '蕴含火行意象与锋锐之气',
        },
        {
          id: 'mat-b',
          name: '雷髓碎晶',
          type: 'monster',
          rank: '灵品',
          quantity: 1,
          element: '雷',
          description: '碎晶中残留雷霆爆裂之意',
        },
      ],
      requestedTags: ['Material.Semantic.Flame'],
    });

    orchestrator.runEventDrivenWorkflow(session);

    expect(order).toEqual([
      'MaterialSubmittedEvent',
      'MaterialAnalyzedEvent',
      'IntentResolvedEvent',
      'RecipeValidatedEvent',
      'EnergyBudgetedEvent',
      'AffixPoolBuiltEvent',
      'AffixRolledEvent',
      'BlueprintComposedEvent',
      'OutcomeMaterializedEvent',
    ]);
    expect(session.state.phase).toBe('outcome_materialized');
    expect(session.state.blueprint).toBeDefined();
    expect(session.state.outcome).toBeDefined();
    expect(orchestrator.getSession(session.id)).toBe(session);
  });

  it('应在 event-driven workflow 失败时自动停止并发布 CraftFailedEvent', () => {
    const orchestrator = new CreationOrchestrator();
    const order: string[] = [];

    [
      'MaterialSubmittedEvent',
      'MaterialAnalyzedEvent',
      'IntentResolvedEvent',
      'CraftFailedEvent',
    ].forEach((eventType) => {
      orchestrator.eventBus.subscribe(eventType, () => order.push(eventType));
    });

    const session = orchestrator.createSession({
      sessionId: 'session-event-driven-failure',
      productType: 'skill',
      materials: [
        {
          id: 'mat-fire',
          name: '离火砂',
          type: 'ore',
          rank: '灵品',
          quantity: 1,
          element: '火',
        },
        {
          id: 'mat-ice',
          name: '玄冰魄',
          type: 'monster',
          rank: '灵品',
          quantity: 1,
          element: '冰',
        },
      ],
    });

    orchestrator.runEventDrivenWorkflow(session);

    expect(order).toEqual([
      'MaterialSubmittedEvent',
      'MaterialAnalyzedEvent',
      'IntentResolvedEvent',
      'CraftFailedEvent',
    ]);
    expect(session.state.phase).toBe('failed');
    expect(session.state.outcome).toBeUndefined();
  });

  it('应允许 event-driven workflow 停在 blueprint 阶段而不自动物化', () => {
    const orchestrator = new CreationOrchestrator();
    const session = orchestrator.createSession({
      sessionId: 'session-event-driven-blueprint-only',
      productType: 'skill',
      materials: [
        {
          id: 'mat-a',
          name: '赤炎精铁',
          type: 'ore',
          rank: '玄品',
          quantity: 2,
          element: '火',
          description: '蕴含火行意象与锋锐之气',
        },
      ],
    });

    orchestrator.runEventDrivenWorkflow(session, { autoMaterialize: false });

    expect(session.state.phase).toBe('blueprint_composed');
    expect(session.state.blueprint).toBeDefined();
    expect(session.state.outcome).toBeUndefined();
  });
});