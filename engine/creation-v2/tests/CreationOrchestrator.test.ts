import { Ability, AbilityType, AttributeType } from '@/engine/creation-v2/contracts/battle';
import { projectAbilityConfig } from '../models';
import { CreationOutcomeMaterializer } from '../adapters/types';
import { TestableCreationOrchestrator as CreationOrchestrator } from './helpers/TestableCreationOrchestrator';
import { AffixRolledEvent, CraftFailedEvent } from '../core/events';
import { CreationTags } from '@/engine/shared/tag-domain';
import { GameplayTags } from '@/engine/shared/tag-domain';
import { matchAll } from '@/engine/creation-v2/affixes';
import { DEFAULT_AFFIX_REGISTRY } from '@/engine/creation-v2/affixes';
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
          type: 'monster',
          rank: '仙品',
          quantity: 3,
          element: '火',
          description: '蕴含火行意象与锋锐之气'
        },
        {
          id: 'mat-b',
          name: '雷髓碎晶',
          type: 'monster',
          rank: '灵品',
          quantity: 1,
          element: '雷',
          description: '碎晶中残留雷霆爆裂之意'
        },
      ],
    });

    orchestrator.submitMaterials(session);
    const fingerprints = orchestrator.analyzeMaterialsWithDefaults(session);
    const intent = orchestrator.resolveIntentWithDefaults(session);
    const recipeMatch = orchestrator.validateRecipeWithDefaults(session);
    const budget = orchestrator.budgetEnergyWithDefaults(session);
    orchestrator.buildAffixPoolWithDefaults(session);
    orchestrator.rollAffixesWithDefaults(session);
    const blueprint = orchestrator.composeBlueprintWithDefaults(session);

    expect(fingerprints[0].semanticTags).toContain('Material.Semantic.Flame');
    expect(intent.productType).toBe('skill');
    expect(recipeMatch.valid).toBe(true);
    expect(budget.effectiveTotal).toBeGreaterThan(0);
    expect(projectAbilityConfig(blueprint.productModel).type).toBe(AbilityType.ACTIVE_SKILL);
    expect(blueprint.productModel.battleProjection.abilityTags).toEqual(
      expect.arrayContaining([GameplayTags.ABILITY.ELEMENT.FIRE]),
    );
    expect(
      blueprint.productModel.battleProjection.abilityTags.some((tag) =>
        ([
          GameplayTags.ABILITY.FUNCTION.DAMAGE,
          GameplayTags.ABILITY.FUNCTION.HEAL,
          GameplayTags.ABILITY.FUNCTION.CONTROL,
          GameplayTags.ABILITY.FUNCTION.BUFF,
        ] as string[]).includes(tag),
      ),
    ).toBe(true);
  });

  it('冰系材料 + self 目标策略时，默认流程应能抽到 self core 而非在 rollAffixes 阶段失败', () => {
    const orchestrator = new CreationOrchestrator();
    const session = orchestrator.createSession({
      sessionId: 'session-ice-self-core',
      productType: 'skill',
      requestedTargetPolicy: {
        team: 'self',
        scope: 'single',
      },
      materials: [
        {
          id: 'mat-ice-1',
          name: '玄冰魄',
          type: 'ore',
          rank: '玄品',
          quantity: 2,
          element: '冰',
          description: '冰寒灵矿，兼具冻气与护心之意',
        },
      ],
    });

    orchestrator.submitMaterials(session);
    orchestrator.recordMaterialAnalysis(session, [
      {
        materialId: 'mat-ice-1',
        materialName: '玄冰魄',
        materialType: 'ore',
        rank: '玄品',
        quantity: 2,
        explicitTags: ['Material.Type.Ore', 'Material.Element.Ice'],
        semanticTags: [
          'Material.Semantic.Freeze',
          'Material.Semantic.Spirit',
        ],
        recipeTags: ['Recipe.Crafter.Skill'],
        energyValue: 28,
        rarityWeight: 2,
        element: '冰',
      },
    ]);

    orchestrator.resolveIntent(session, {
      productType: 'skill',
      dominantTags: [
        'Material.Semantic.Freeze',
        'Material.Semantic.Spirit',
      ],
      elementBias: '冰',
      targetPolicyBias: {
        team: 'self',
        scope: 'single',
      },
    });
    orchestrator.validateRecipe(session, {
      recipeId: 'skill-ice-self',
      valid: true,
      matchedTags: ['Recipe.Crafter.Skill'],
      unlockedAffixCategories: ['skill_core', 'skill_variant'],
      reservedEnergy: 3,
    });
    orchestrator.budgetEnergy(session, {
      baseTotal: 36,
      effectiveTotal: 36,
      reserved: 3,
      spent: 0,
      remaining: 33,
      initialRemaining: 33,
      allocations: [],
      rejections: [],
      sources: [{ source: '玄冰魄', amount: 36 }],
    });
    orchestrator.buildAffixPoolWithDefaults(session);
    expect(session.state.affixPool.map((affix) => affix.id)).toContain(
      'skill-core-ice-frost-guard',
    );
    const affixes = orchestrator.rollAffixesWithDefaults(session);

    expect(affixes.some((affix) => affix.category === 'skill_core')).toBe(true);
    expect(affixes.map((affix) => affix.id)).toContain('skill-core-ice-frost-guard');
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
          description: '蕴含烈焰意象的矿石'
        },
      ],
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
        element: '火'
      },
    ];
    const recipeMatch: RecipeMatch = {
      recipeId: 'skill-fire-core',
      valid: true,
      matchedTags: ['Recipe.Matched.Fire'],
      unlockedAffixCategories: ['skill_core', 'skill_variant'],
      reservedEnergy: 8,
    };
    const budget: EnergyBudget = {
      baseTotal: 24,
      effectiveTotal: 24,
      reserved: 8,
      spent: 0,
      remaining: 16,
      initialRemaining: 16,
      allocations: [],
      rejections: [],
      sources: [{ source: '赤炎精铁', amount: 24 }],
    };
    const blueprint: CreationBlueprint = {
      productType: 'skill',
      productModel: {
        productType: 'skill',
        slug: 'craft-skill-session-active',
        name: '焚岳诀',
        description: '将烈焰压缩成一线，瞬间焚穿敌躯。',
        projectionQuality: '玄品',
        outcomeTags: ['Outcome.ActiveSkill'],
        affixes: [
          {
            id: 'core-flame-burst',
            name: '炎爆核心',
            category: 'skill_core',
            match: matchAll([]),
            tags: ['offensive', 'fire'],
            weight: 1,
            energyCost: 8,
            rollScore: 0.91,
            rollEfficiency: 1,
            finalMultiplier: 1,
            isPerfect: false,
            effectTemplate: { type: 'damage', params: { value: 10 } } as any
          },
        ],
        battleProjection: {
          projectionKind: 'active_skill',
          abilityTags: [
            GameplayTags.ABILITY.FUNCTION.DAMAGE,
            GameplayTags.ABILITY.CHANNEL.MAGIC,
            GameplayTags.ABILITY.ELEMENT.FIRE,
          ],
          mpCost: 18,
          cooldown: 2,
          priority: 12,
          targetPolicy: {
            team: 'enemy',
            scope: 'single'
          },
          effects: [
            {
              type: 'damage',
              params: {
                value: {
                  base: 24,
                  attribute: AttributeType.MAGIC_ATK,
                  coefficient: 0.8
                }
              }
            },
          ]
        }
      },
    };

    orchestrator.submitMaterials(session);
    orchestrator.recordMaterialAnalysis(session, fingerprints);
    orchestrator.resolveIntent(session, {
      productType: 'skill',
      dominantTags: ['fire', 'burst'],
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
    expect(session.state.inputTags).toContain('Material.Semantic.Flame');
    expect(session.state.inputTags).not.toContain('Outcome.ActiveSkill');
  });

  it('应能将 artifact 蓝图物化为 battle-v5 被动能力实例', () => {
    const orchestrator = new CreationOrchestrator();
    const session = orchestrator.createSession({
      sessionId: 'session-passive',
      cultivatorId: 'creator-1',
      creatorName: '玄真子',
      realm: '化神',
      realmStage: '后期',
      productType: 'artifact',
      materials: [
        {
          id: 'mat-2',
          name: '玄冰魄玉',
          type: 'ore',
          rank: '真品',
          quantity: 1,
          element: '冰'
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
        element: '冰'
      },
    ]);
    orchestrator.resolveIntent(session, {
      productType: 'artifact',
      dominantTags: ['ice', 'defensive'],
      elementBias: '冰',
    });
    orchestrator.composeBlueprint(session, {
      productType: 'artifact',
      productModel: {
        productType: 'artifact',
        slug: 'craft-passive-session-passive',
        name: '玄冰护心佩',
        description: '寒意护体，遇袭时凝结冰盾。',
        projectionQuality: '真品',
        outcomeTags: ['Outcome.PassiveAbility', 'Outcome.Artifact'],
        affixes: [],
        artifactConfig: {
          equipPolicy: 'single_slot',
          persistencePolicy: 'inventory_bound',
          progressionPolicy: 'reforgeable'
        },
        battleProjection: {
          projectionKind: 'artifact_passive',
          abilityTags: ['Ability.Kind.Artifact', 'Ability.Element.Ice'],
          listeners: [
            {
              eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
              scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
              priority: 50,
              effects: [
                {
                  type: 'shield',
                  params: {
                    value: {
                      base: 12,
                      attribute: AttributeType.SPIRIT,
                      coefficient: 0.4
                    }
                  }
                },
              ]
            },
          ]
        }
      },
    });

    const outcome = orchestrator.materializeOutcome(session);

    expect(outcome.ability.type).toBe(AbilityType.PASSIVE_SKILL);
    expect(outcome.ability.name).toBe('玄冰护心佩');
    expect(outcome.blueprint.productModel.productType).toBe('artifact');
    const artifactModel = outcome.blueprint.productModel;
    if (artifactModel.productType === 'artifact') {
      // 手工 compose 的蓝图允许不带 metadata，兼容旧链路与测试桩。
      expect(artifactModel.metadata).toBeUndefined();
    }
  });

  it('应在 artifact composer 链路中注入 metadata', () => {
    const orchestrator = new CreationOrchestrator();
    const session = orchestrator.createSession({
      sessionId: 'session-artifact-metadata',
      cultivatorId: 'creator-1',
      creatorName: '玄真子',
      realm: '化神',
      realmStage: '后期',
      productType: 'artifact',
      materials: [
        {
          id: 'mat-a',
          name: '玄冰矿髓',
          type: 'ore',
          rank: '玄品',
          quantity: 2,
          element: '冰',
          description: '冰系护体矿材',
        },
        {
          id: 'mat-b',
          name: '灵木芯',
          type: 'herb',
          rank: '灵品',
          quantity: 1,
          element: '木',
          description: '含生机的柔性辅材',
        },
      ],
    });
    const coreDef = DEFAULT_AFFIX_REGISTRY.queryById('artifact-panel-weapon-dual-atk');
    const panelDef = DEFAULT_AFFIX_REGISTRY.queryById('artifact-panel-atk');
    if (!coreDef || !panelDef) {
      throw new Error('artifact affix defs not found');
    }

    session.state.intent = {
      productType: 'artifact',
      dominantTags: ['Material.Semantic.Blade'],
      slotBias: 'weapon',
    };
    session.state.recipeMatch = {
      recipeId: 'artifact-default',
      valid: true,
      matchedTags: ['Recipe.Crafter.Artifact'],
      unlockedAffixCategories: ['artifact_core', 'artifact_panel'],
    };
    session.state.energyBudget = {
      baseTotal: 50,
      effectiveTotal: 50,
      reserved: 10,
      spent: 20,
      remaining: 20,
      initialRemaining: 40,
      allocations: [],
      rejections: [],
      sources: [{ source: 'test', amount: 50 }],
    };
    session.state.materialFingerprints = [
      {
        materialName: '玄冰矿髓',
        materialType: 'ore',
        rank: '玄品',
        quantity: 2,
        explicitTags: [],
        semanticTags: [],
        recipeTags: [],
        energyValue: 20,
        rarityWeight: 1,
      },
      {
        materialName: '灵木芯',
        materialType: 'herb',
        rank: '灵品',
        quantity: 1,
        explicitTags: [],
        semanticTags: [],
        recipeTags: [],
        energyValue: 10,
        rarityWeight: 1,
      },
    ];
    session.state.rolledAffixes = [
      {
        ...coreDef,
        name: coreDef.displayName,
        description: coreDef.displayDescription,
        tags: [],
        rollScore: 0.9,
        rollEfficiency: 1,
        finalMultiplier: 1,
        isPerfect: false,
      },
      {
        ...panelDef,
        name: panelDef.displayName,
        description: panelDef.displayDescription,
        tags: [],
        rollScore: 0.8,
        rollEfficiency: 1,
        finalMultiplier: 1,
        isPerfect: false,
      },
    ];
    const blueprint = orchestrator.composeBlueprintWithDefaults(session);

    expect(blueprint.productModel.productType).toBe('artifact');
    if (blueprint.productModel.productType === 'artifact') {
      expect(blueprint.productModel.metadata).toMatchObject({
        creatorName: '玄真子',
        creatorCultivatorId: 'creator-1',
        anchorRealm: '化神',
        anchorRealmStage: '后期',
      });
      expect(typeof blueprint.productModel.metadata?.craftedAt).toBe('string');
    }
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
          type: 'monster',
          rank: '玄品',
          quantity: 2,
          element: '火'
        },
        {
          id: 'mat-ice',
          name: '玄冰魄',
          type: 'monster',
          rank: '灵品',
          quantity: 1,
          element: '冰'
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
      dominantTags: ['Outcome.ActiveSkill'],
    });

    expect(() => orchestrator.rollAffixesWithDefaults(session)).toThrow(
      'Cannot roll affixes before energy budgeting',
    );
  });

  it('当抽取结果缺少 core 时应抛出 CreationError (Selection 阶段)', () => {
    const orchestrator = new CreationOrchestrator();
    const session = orchestrator.createSession({
      sessionId: 'session-core-invariant',
      productType: 'skill',
      materials: [],
    });

    orchestrator.resolveIntent(session, {
      productType: 'skill',
      dominantTags: ['Material.Semantic.Burst'],
    });
    orchestrator.budgetEnergy(session, {
      baseTotal: 20,
      effectiveTotal: 20,
      reserved: 4,
      spent: 0,
      remaining: 16,
      initialRemaining: 16,
      allocations: [],
      rejections: [],
      sources: [{ source: '测试材料', amount: 20 }],
    });
    orchestrator.buildAffixPool(session, [
      {
        id: 'skill-prefix-only',
        name: 'only-prefix',
        category: 'skill_variant',
        match: matchAll([]),
        tags: ['Material.Semantic.Burst'],
        weight: 100,
        energyCost: 8,
        effectTemplate: { type: 'damage', params: { value: 10 } } as any,
      },
    ]);
    expect(() => orchestrator.rollAffixesWithDefaults(session)).toThrow(
      /未能抽选到核心词缀/,
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
      baseTotal: 30,
      effectiveTotal: 30,
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
        category: 'skill_core',
        match: matchAll([]),
        tags: ['Material.Semantic.Blade'],
        weight: 80,
        energyCost: 8,
        rollScore: 1,
        rollEfficiency: 1,
        finalMultiplier: 1,
        isPerfect: false,
        effectTemplate: { type: 'damage', params: { value: 10 } } as any,
      },
      {
        id: 'skill-prefix-crit-boost',
        name: '锋锐',
        category: 'skill_variant',
        match: matchAll([]),
        tags: ['Material.Semantic.Blade'],
        weight: 60,
        energyCost: 6,
        rollScore: 0.75,
        rollEfficiency: 1,
        finalMultiplier: 1,
        isPerfect: false,
        effectTemplate: { type: 'damage', params: { value: 10 } } as any,
      },
    ]);

    expect(session.state.energyBudget).toMatchObject({
      effectiveTotal: 30,
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
      productType: 'skill',
      productModel: {
        productType: 'skill',
        slug: 'test-abstract-materializer',
        name: '测试造物',
        description: '抽象物化器测试',
        projectionQuality: '凡品',
        outcomeTags: ['Outcome.ActiveSkill'],
        affixes: [],
        battleProjection: {
          projectionKind: 'active_skill',
          abilityTags: [
            GameplayTags.ABILITY.FUNCTION.DAMAGE,
            GameplayTags.ABILITY.CHANNEL.MAGIC,
          ],
          mpCost: 10,
          cooldown: 1,
          priority: 10,
          targetPolicy: {
            team: 'enemy',
            scope: 'single'
          },
          effects: [
            {
              type: 'damage',
              params: {
                value: {
                  base: 10,
                  attribute: AttributeType.MAGIC_ATK,
                  coefficient: 0,
                }
              }
            },
          ]
        }
      },
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
          type: 'monster',
          rank: '玄品',
          quantity: 2,
          element: '火',
          description: '蕴含火行意象与锋锐之气'
        },
        {
          id: 'mat-b',
          name: '雷髓碎晶',
          type: 'monster',
          rank: '灵品',
          quantity: 1,
          element: '雷',
          description: '碎晶中残留雷霆爆裂之意'
        },
      ],
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

  it('AffixRolledEvent 应携带 selectionAudit 与 finalSelectionDecision 正式快照', () => {
    const orchestrator = new CreationOrchestrator();
    let affixRolledEvent: AffixRolledEvent | undefined;

    orchestrator.eventBus.subscribe<AffixRolledEvent>(
      'AffixRolledEvent',
      (event) => {
        affixRolledEvent = event;
      },
      CreationEventPriorityLevel.BLUEPRINT_COMPOSITION,
    );

    const session = orchestrator.createSession({
      sessionId: 'session-affix-rolled-event-payload',
      productType: 'skill',
      materials: [
        {
          id: 'mat-a',
          name: '赤炎精铁',
          type: 'monster',
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
    });

    orchestrator.runEventDrivenWorkflow(session, { autoMaterialize: false });

    expect(affixRolledEvent).toBeDefined();
    expect(affixRolledEvent?.selectionAudit).toBeDefined();
    expect(affixRolledEvent?.finalSelectionDecision).toBeDefined();
    expect(affixRolledEvent?.selectionAudit?.finalDecision).toBe(
      affixRolledEvent?.finalSelectionDecision,
    );
    expect(affixRolledEvent?.finalSelectionDecision).toBe(
      session.state.affixSelectionFinalDecision,
    );
    expect(
      Object.prototype.hasOwnProperty.call(affixRolledEvent, 'selectionDecision'),
    ).toBe(false);
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
          element: '火'
        },
        {
          id: 'mat-ice',
          name: '玄冰魄',
          type: 'monster',
          rank: '灵品',
          quantity: 1,
          element: '冰'
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

  it('应在输入超出材料数量上限时直接失败并终止流程', () => {
    const orchestrator = new CreationOrchestrator();
    const order: string[] = [];

    ['MaterialSubmittedEvent', 'CraftFailedEvent'].forEach((eventType) => {
      orchestrator.eventBus.subscribe(eventType, () => order.push(eventType));
    });

    const session = orchestrator.createSession({
      sessionId: 'session-event-driven-invalid-input',
      productType: 'skill',
      materials: [
        { id: 'm1', name: '甲', type: 'ore', rank: '凡品', quantity: 1 },
        { id: 'm2', name: '乙', type: 'ore', rank: '凡品', quantity: 1 },
        { id: 'm3', name: '丙', type: 'ore', rank: '凡品', quantity: 1 },
        { id: 'm4', name: '丁', type: 'ore', rank: '凡品', quantity: 1 },
        { id: 'm5', name: '戊', type: 'ore', rank: '凡品', quantity: 1 },
        { id: 'm6', name: '己', type: 'ore', rank: '凡品', quantity: 1 },
        { id: 'm7', name: '庚', type: 'ore', rank: '凡品', quantity: 1 },
      ],
    });

    orchestrator.runEventDrivenWorkflow(session);

    expect(order).toEqual(['CraftFailedEvent']);
    expect(session.state.phase).toBe('failed');
    expect(session.state.failureReason).toContain('材料种类数量必须在');
  });

  it('应允许 event-driven workflow 停在 blueprint 阶段而不自动物化', async () => {
    const orchestrator = new CreationOrchestrator();
    const session = orchestrator.createSession({
      sessionId: 'session-event-driven-blueprint-only',
      productType: 'skill',
      materials: [
        {
          id: 'mat-a',
          name: '赤炎精铁',
          type: 'monster',
          rank: '玄品',
          quantity: 2,
          element: '火',
          description: '蕴含火行意象与锋锐之气'
        },
        {
          id: 'mat-b',
          name: '雷髓碎晶',
          type: 'monster',
          rank: '灵品',
          quantity: 1,
          element: '雷',
          description: '碎晶中残留雷霆爆裂之意'
        },
      ],
    });

    orchestrator.runEventDrivenWorkflow(session, { autoMaterialize: false });
    await orchestrator.waitForWorkflowCompletion(session.id);

    expect(session.state.phase).toBe('blueprint_composed');
    expect(session.state.blueprint).toBeDefined();
    expect(session.state.outcome).toBeUndefined();
  });
});
