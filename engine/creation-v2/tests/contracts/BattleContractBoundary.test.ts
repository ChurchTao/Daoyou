import { AffixEffectTranslator } from '@/engine/creation-v2/affixes/AffixEffectTranslator';
import { DEFAULT_AFFIX_REGISTRY } from '@/engine/creation-v2/affixes';
import { TestableCreationOrchestrator as CreationOrchestrator } from '@/engine/creation-v2/tests/helpers/TestableCreationOrchestrator';
import {
  runCreationBattleBenchmark,
  runCreationBattleDuel,
} from '@/engine/creation-v2/tests/helpers/BattleRegressionHarness';
import { CREATION_LISTENER_PRIORITIES } from '@/engine/creation-v2/config/CreationBalance';
import { projectAbilityConfig } from '@/engine/creation-v2/models';
import { AbilityType } from '@/engine/creation-v2/contracts/battle';
import { EventBus, Unit } from '@/engine/creation-v2/contracts/battle-testkit';
import type {
  DamageRequestEvent,
  DamageTakenEvent,
} from '@/engine/creation-v2/contracts/battle-testkit';
import { GameplayTags } from '@/engine/battle-v5/core/GameplayTags';
import {
  AbilityType as BattleAbilityType,
  AttributeType as BattleAttributeType,
  DamageSource,
  DamageType,
  ModifierType as BattleModifierType,
} from '@/engine/battle-v5/core/types';
import { AbilityFactory } from '@/engine/battle-v5/factories/AbilityFactory';
import { DamageSystem } from '@/engine/battle-v5/systems/DamageSystem';
import type { ActiveSkillBattleProjection } from '@/engine/creation-v2/models';
import type { SkillProductModel, ArtifactProductModel } from '@/engine/creation-v2/models';
import type { Material } from '@/types/cultivator';

/**
 * BattleContractBoundary
 * 验证 creation-v2 产物的 battle 契约完整性：
 * - abilityConfig 字段符合 battle-v5 AbilityFactory 期望
 * - projectAbilityConfig 可被物化为可执行的 Ability 实例
 * - 被 Unit 使用后不会抛出运行时错误
 */


function createSkillBlueprint(sessionId: string = 'battle-contract-skill') {
  const orchestrator = new CreationOrchestrator();
  const session = orchestrator.createSession({
    sessionId,
    productType: 'skill',
    materials: [
      {
        id: 'mat-fire',
        name: '赤炎精铁',
        type: 'ore',
        rank: '灵品',
        quantity: 2,
        element: '火',
        description: '蕴含火行意象',
      },
    ],
  });

  orchestrator.submitMaterials(session);
  orchestrator.analyzeMaterialsWithDefaults(session);
  orchestrator.resolveIntentWithDefaults(session);
  orchestrator.validateRecipeWithDefaults(session);
  orchestrator.budgetEnergyWithDefaults(session);
  orchestrator.buildAffixPoolWithDefaults(session);
  orchestrator.rollAffixesWithDefaults(session);
  return orchestrator.composeBlueprintWithDefaults(session);
}

function createArtifactBlueprint(sessionId: string = 'battle-contract-artifact') {
  const orchestrator = new CreationOrchestrator();
  const session = orchestrator.createSession({
    sessionId,
    productType: 'artifact',
    materials: [
      {
        id: 'mat-ore',
        name: '寒铁矿',
        type: 'ore',
        rank: '灵品',
        quantity: 1,
        element: '水',
        description: '蕴含寒水之气',
      },
    ],
  });

  orchestrator.submitMaterials(session);
  orchestrator.analyzeMaterialsWithDefaults(session);
  orchestrator.resolveIntentWithDefaults(session);
  orchestrator.validateRecipeWithDefaults(session);
  orchestrator.budgetEnergyWithDefaults(session);
  orchestrator.buildAffixPoolWithDefaults(session);
  orchestrator.rollAffixesWithDefaults(session);
  return orchestrator.composeBlueprintWithDefaults(session);
}

function createAccessoryArtifactBlueprint(
  sessionId: string = 'battle-contract-artifact-accessory',
) {
  const orchestrator = new CreationOrchestrator();
  const session = orchestrator.createSession({
    sessionId,
    productType: 'artifact',
    requestedSlot: 'accessory',
    materials: [
      {
        id: 'mat-accessory',
        name: '灵纹玉佩',
        type: 'ore',
        rank: '玄品',
        quantity: 1,
        element: '风',
        description: '蕴含机动与灵性的饰品胚材',
      },
    ],
  });

  orchestrator.submitMaterials(session);
  orchestrator.analyzeMaterialsWithDefaults(session);
  orchestrator.resolveIntentWithDefaults(session);
  orchestrator.validateRecipeWithDefaults(session);
  orchestrator.budgetEnergyWithDefaults(session);
  orchestrator.buildAffixPoolWithDefaults(session);
  orchestrator.rollAffixesWithDefaults(session);
  return orchestrator.composeBlueprintWithDefaults(session);
}

function createArmorArtifactBlueprint(
  sessionId: string = 'battle-contract-artifact-armor',
) {
  const orchestrator = new CreationOrchestrator();
  const session = orchestrator.createSession({
    sessionId,
    productType: 'artifact',
    requestedSlot: 'armor',
    materials: [
      {
        id: 'mat-armor',
        name: '玄甲铁片',
        type: 'ore',
        rank: '玄品',
        quantity: 1,
        element: '水',
        description: '蕴含护体与稳固气机的甲片胚材',
      },
    ],
  });

  orchestrator.submitMaterials(session);
  orchestrator.analyzeMaterialsWithDefaults(session);
  orchestrator.resolveIntentWithDefaults(session);
  orchestrator.validateRecipeWithDefaults(session);
  orchestrator.budgetEnergyWithDefaults(session);
  orchestrator.buildAffixPoolWithDefaults(session);
  orchestrator.rollAffixesWithDefaults(session);
  return orchestrator.composeBlueprintWithDefaults(session);
}

const BATTLE_SMOKE_MATERIALS: Record<'skill' | 'artifact' | 'gongfa', Material[]> = {
  skill: [
    {
      id: 'battle-smoke-skill-ore',
      name: '灼雷晶矿',
      type: 'ore',
      rank: '地品',
      quantity: 2,
      element: '火',
      description: '蕴含炽火与雷暴之力',
    },
  ],
  artifact: [
    {
      id: 'battle-smoke-artifact-ore',
      name: '玄甲寒铁',
      type: 'ore',
      rank: '灵品',
      quantity: 2,
      element: '水',
      description: '偏防御与护体的灵矿',
    },
  ],
  gongfa: [
    {
      id: 'battle-smoke-gongfa-manual',
      name: '归元残卷',
      type: 'gongfa_manual',
      rank: '玄品',
      quantity: 1,
      description: '记载吐纳与养气之法',
    },
    {
      id: 'battle-smoke-gongfa-herb',
      name: '回灵草',
      type: 'herb',
      rank: '灵品',
      quantity: 2,
      description: '提升续航与恢复能力',
    },
  ],
};

const ARTIFACT_SLOT_BENCHMARK_CASES = [
  {
    slot: 'weapon' as const,
    materials: [
      {
        id: 'battle-benchmark-weapon',
        name: '锋灵矿',
        type: 'ore',
        rank: '玄品',
        quantity: 2,
        element: '金',
        description: '偏战器与双攻方向的灵矿',
      },
    ],
  },
  {
    slot: 'armor' as const,
    materials: [
      {
        id: 'battle-benchmark-armor',
        name: '玄甲铁片',
        type: 'ore',
        rank: '玄品',
        quantity: 2,
        element: '水',
        description: '偏护甲与双防方向的灵矿',
      },
    ],
  },
  {
    slot: 'accessory' as const,
    materials: [
      {
        id: 'battle-benchmark-accessory',
        name: '回风灵佩',
        type: 'ore',
        rank: '玄品',
        quantity: 2,
        element: '风',
        description: '偏饰品与身法方向的灵矿',
      },
    ],
  },
];

function withFixedRandom<T>(value: number, execute: () => T): T {
  const originalRandom = Math.random;
  Math.random = () => value;

  try {
    return execute();
  } finally {
    Math.random = originalRandom;
  }
}

describe('BattleContractBoundary — battle 契约验证', () => {
  beforeEach(() => {
    EventBus.instance.reset();
  });

  afterEach(() => {
    EventBus.instance.reset();
  });

  describe('abilityConfig 结构符合 battle-v5 契约', () => {
    it('skill 蓝图 abilityConfig.type 应为 ACTIVE_SKILL', () => {
      const blueprint = createSkillBlueprint();
      expect(projectAbilityConfig(blueprint.productModel).type).toBe(AbilityType.ACTIVE_SKILL);
    });

    it('artifact 蓝图 abilityConfig.type 应为 PASSIVE_SKILL', () => {
      const blueprint = createArtifactBlueprint();
      expect(projectAbilityConfig(blueprint.productModel).type).toBe(AbilityType.PASSIVE_SKILL);
    });

    it('skill abilityConfig 应包含 mpCost 和 cooldown', () => {
      const blueprint = createSkillBlueprint();
      const config = projectAbilityConfig(blueprint.productModel);

      if (config.type === AbilityType.ACTIVE_SKILL) {
        expect(typeof config.mpCost).toBe('number');
        expect(typeof config.cooldown).toBe('number');
        expect(config.mpCost).toBeGreaterThanOrEqual(0);
        expect(config.cooldown).toBeGreaterThanOrEqual(0);
      }
    });

    it('skill abilityConfig 应包含 targetPolicy', () => {
      const blueprint = createSkillBlueprint();
      const config = projectAbilityConfig(blueprint.productModel);

      if (config.type === AbilityType.ACTIVE_SKILL) {
        expect(config.targetPolicy).toBeDefined();
        expect(['enemy', 'self', 'ally']).toContain(config.targetPolicy?.team);
        expect(['single', 'all', 'random']).toContain(config.targetPolicy?.scope);
      }
    });
  });

  describe('abilityConfig 从 productModel 产出', () => {
    it('skill 蓝图 abilityConfig.type 应与 productModel.battleProjection 一致', () => {
      const blueprint = createSkillBlueprint();
      const model = blueprint.productModel as SkillProductModel;

      expect(projectAbilityConfig(blueprint.productModel).type).toBe(AbilityType.ACTIVE_SKILL);
      expect(model.battleProjection.projectionKind).toBe('active_skill');
    });

    it('artifact 蓝图 abilityConfig.type 应与 productModel.battleProjection 一致', () => {
      const blueprint = createArtifactBlueprint();
      const model = blueprint.productModel as ArtifactProductModel;

      expect(projectAbilityConfig(blueprint.productModel).type).toBe(AbilityType.PASSIVE_SKILL);
      expect(model.battleProjection.projectionKind).toBe('artifact_passive');
    });
  });

  describe('battleProjection 字段完整性', () => {
    it('skill battleProjection 应包含完整的 active_skill 投影', () => {
      const blueprint = createSkillBlueprint();
      const projection = (blueprint.productModel as SkillProductModel).battleProjection as ActiveSkillBattleProjection;

      expect(projection.projectionKind).toBe('active_skill');
      expect(Array.isArray(projection.abilityTags)).toBe(true);
      expect(projection.abilityTags.length).toBeGreaterThan(0);
      expect(typeof projection.mpCost).toBe('number');
      expect(typeof projection.cooldown).toBe('number');
      expect(typeof projection.priority).toBe('number');
      expect(projection.targetPolicy).toBeDefined();
      expect(Array.isArray(projection.effects)).toBe(true);
    });

    it('skill battleProjection 的 effects 在词缀为空时应包含保底伤害效果', () => {
      const blueprint = createSkillBlueprint();
      const projection = (blueprint.productModel as SkillProductModel).battleProjection as ActiveSkillBattleProjection;

      // 词缀为空时 FallbackOutcomeRules 注入保底伤害效果
      expect(projection.effects.length).toBeGreaterThan(0);
      expect(projection.effects[0].type).toBe('damage');
    });
  });

  describe('battle tags 契约', () => {
    it('skill 蓝图 tags 应包含 Ability.Type.Damage 标签', () => {
      const blueprint = createSkillBlueprint();
      expect(blueprint.productModel.tags).toContain('Ability.Type.Damage');
    });

    it('artifact 蓝图 tags 应包含 Artifact 标签', () => {
      const blueprint = createArtifactBlueprint();
      expect(blueprint.productModel.tags.some((t) => t.includes('Artifact'))).toBe(true);
    });

    it('weapon artifact 蓝图应投影双攻 core modifiers', () => {
      const blueprint = createArtifactBlueprint();
      const model = blueprint.productModel as ArtifactProductModel;

      expect(model.artifactConfig.slot).toBe('weapon');
      expect(model.battleProjection.modifiers?.length).toBe(2);
    });

    it('armor artifact 蓝图应投影双防 core modifiers', () => {
      const blueprint = createArmorArtifactBlueprint();
      const model = blueprint.productModel as ArtifactProductModel;

      expect(model.artifactConfig.slot).toBe('armor');
      expect(model.battleProjection.modifiers?.length).toBe(2);
    });

    it('accessory artifact 蓝图应投影两个二级属性 core modifiers', () => {
      const blueprint = createAccessoryArtifactBlueprint();
      const model = blueprint.productModel as ArtifactProductModel;

      expect(model.artifactConfig.slot).toBe('accessory');
      expect(model.battleProjection.modifiers?.length).toBe(2);
    });
  });

  describe('battle-v5 smoke execution', () => {
    it.each([
      ['skill', BATTLE_SMOKE_MATERIALS.skill],
      ['artifact', BATTLE_SMOKE_MATERIALS.artifact],
      ['gongfa', BATTLE_SMOKE_MATERIALS.gongfa],
    ] as const)(
      '%s 产物应可挂载到 Unit 并完成一次真实战斗执行',
      (productType, materials) => {
        const duel = runCreationBattleDuel({
          productType,
          materials,
          seed: 20260403,
        });

        expect(duel).toBeDefined();
        expect(duel!.battleResult.turns).toBeGreaterThan(0);
        expect(duel!.battleResult.winner).toBeDefined();
        expect(duel!.battleResult.logs.length).toBeGreaterThan(0);
        expect(duel!.challenger.abilities.getAllAbilities().length).toBeGreaterThanOrEqual(2);
        expect(duel!.defender.abilities.getAllAbilities().length).toBe(1);
      },
    );

    it.each(ARTIFACT_SLOT_BENCHMARK_CASES)(
      'artifact $slot benchmark helper 应输出回合统计摘要',
      ({ slot, materials }) => {
        const benchmark = runCreationBattleBenchmark({
          productType: 'artifact',
          requestedSlot: slot,
          materials,
          seeds: [20260407, 20260408],
        });

        expect(benchmark).toBeDefined();
        expect(benchmark!.summary.samples).toBe(2);
        expect(benchmark!.summary.maxTurnsReached).toBeGreaterThanOrEqual(0);
        expect(benchmark!.summary.averageTurns).toBeGreaterThan(0);
        expect(benchmark!.summary.averageDamagePerHit).toBeGreaterThan(0);
        expect(benchmark!.summary.averageHealShare).toBeGreaterThanOrEqual(0);
        expect(benchmark!.summary.averageHealShare).toBeLessThanOrEqual(1);
        expect(benchmark!.summary.averageShieldShare).toBeGreaterThanOrEqual(0);
        expect(benchmark!.summary.averageShieldShare).toBeLessThanOrEqual(1);
        expect(benchmark!.summary.averageControlSkipRate).toBeGreaterThanOrEqual(0);
        expect(benchmark!.summary.averageControlSkipRate).toBeLessThanOrEqual(1);
      },
    );

    it('artifact 分槽 benchmark 应体现 weapon 更偏输出，同时各槽位都保持 8-20 回合基线', () => {
      const [weaponCase, armorCase, accessoryCase] = ARTIFACT_SLOT_BENCHMARK_CASES;

      const weaponBenchmark = runCreationBattleBenchmark({
        productType: 'artifact',
        requestedSlot: weaponCase.slot,
        materials: weaponCase.materials,
        seeds: [20260407, 20260408],
      });
      const armorBenchmark = runCreationBattleBenchmark({
        productType: 'artifact',
        requestedSlot: armorCase.slot,
        materials: armorCase.materials,
        seeds: [20260407, 20260408],
      });
      const accessoryBenchmark = runCreationBattleBenchmark({
        productType: 'artifact',
        requestedSlot: accessoryCase.slot,
        materials: accessoryCase.materials,
        seeds: [20260407, 20260408],
      });

      expect(weaponBenchmark).toBeDefined();
      expect(armorBenchmark).toBeDefined();
      expect(accessoryBenchmark).toBeDefined();

      for (const benchmark of [weaponBenchmark!, armorBenchmark!, accessoryBenchmark!]) {
        expect(benchmark.summary.averageTurns).toBeGreaterThanOrEqual(8);
        expect(benchmark.summary.averageTurns).toBeLessThanOrEqual(20);
        expect(benchmark.summary.challengerWinRate).toBeGreaterThan(0.5);
      }

      expect(weaponBenchmark!.summary.averageDamagePerHit).toBeGreaterThan(
        armorBenchmark!.summary.averageDamagePerHit,
      );
      expect(weaponBenchmark!.summary.averageDamagePerHit).toBeGreaterThan(
        accessoryBenchmark!.summary.averageDamagePerHit,
      );
      expect(armorBenchmark!.summary.averageShieldShare).toBeLessThanOrEqual(0.05);
      expect(accessoryBenchmark!.summary.averageHealShare).toBeLessThanOrEqual(0.05);
    });

    it('gongfa 元素专精 listener 应只放大匹配元素的伤害请求', () => {
      const damageSystem = new DamageSystem();

      try {
        const attacker = new Unit('element-attacker', '焚诀修士', {
          [BattleAttributeType.SPIRIT]: 100,
          [BattleAttributeType.VITALITY]: 100,
          [BattleAttributeType.SPEED]: 100,
          [BattleAttributeType.WILLPOWER]: 100,
          [BattleAttributeType.WISDOM]: 100,
        });
        const defender = new Unit('element-defender', '试功木桩', {
          [BattleAttributeType.SPIRIT]: 100,
          [BattleAttributeType.VITALITY]: 100,
          [BattleAttributeType.SPEED]: 100,
          [BattleAttributeType.WILLPOWER]: 100,
          [BattleAttributeType.WISDOM]: 100,
        });

        defender.attributes.addModifier({
          id: 'battle-contract-no-crit',
          attrType: BattleAttributeType.CRIT_RESIST,
          type: BattleModifierType.FIXED,
          value: 1,
          source: 'battle-contract-test',
        });
        defender.updateDerivedStats();

        attacker.abilities.addAbility(
          AbilityFactory.create({
            slug: 'gongfa_fire_specialization_test',
            name: '离火专精',
            type: BattleAbilityType.PASSIVE_SKILL,
            listeners: [
              {
                id: 'gongfa_fire_specialization_listener',
                eventType: 'DamageRequestEvent',
                scope: 'owner_as_caster',
                priority: CREATION_LISTENER_PRIORITIES.damageRequest,
                effects: [
                  {
                    type: 'percent_damage_modifier',
                    conditions: [
                      {
                        type: 'ability_has_tag',
                        params: { tag: GameplayTags.ABILITY.ELEMENT_FIRE },
                      },
                    ],
                    params: {
                      mode: 'increase',
                      value: 0.25,
                    },
                  },
                ],
              },
            ],
          }),
        );

        const fireAbility = AbilityFactory.create({
          slug: 'battle-contract-fire-skill',
          name: '炎诀',
          type: BattleAbilityType.ACTIVE_SKILL,
          targetPolicy: { team: 'enemy', scope: 'single' },
          tags: [
            GameplayTags.ABILITY.TYPE_DAMAGE,
            GameplayTags.ABILITY.TYPE_MAGIC,
            GameplayTags.ABILITY.ELEMENT_FIRE,
          ],
          effects: [],
        });

        const waterAbility = AbilityFactory.create({
          slug: 'battle-contract-water-skill',
          name: '寒诀',
          type: BattleAbilityType.ACTIVE_SKILL,
          targetPolicy: { team: 'enemy', scope: 'single' },
          tags: [
            GameplayTags.ABILITY.TYPE_DAMAGE,
            GameplayTags.ABILITY.TYPE_MAGIC,
            GameplayTags.ABILITY.ELEMENT_WATER,
          ],
          effects: [],
        });

        const fireEvent = withFixedRandom(0.5, () => {
          const event = {
            type: 'DamageRequestEvent' as const,
            timestamp: Date.now(),
            caster: attacker,
            target: defender,
            ability: fireAbility,
            damageSource: DamageSource.DIRECT,
            damageType: DamageType.MAGICAL,
            baseDamage: 500,
            finalDamage: 500,
            isCritical: false,
          };

          EventBus.instance.publish(event);
          return event;
        });

        defender.setHp(defender.getMaxHp());

        const waterEvent = withFixedRandom(0.5, () => {
          const event = {
            type: 'DamageRequestEvent' as const,
            timestamp: Date.now(),
            caster: attacker,
            target: defender,
            ability: waterAbility,
            damageSource: DamageSource.DIRECT,
            damageType: DamageType.MAGICAL,
            baseDamage: 500,
            finalDamage: 500,
            isCritical: false,
          };

          EventBus.instance.publish(event);
          return event;
        });

        expect(fireEvent.damageIncreasePctBucket).toBeCloseTo(0.25);
        expect(waterEvent.damageIncreasePctBucket ?? 0).toBe(0);
        expect(fireEvent.finalDamage).toBeGreaterThan(waterEvent.finalDamage);
      } finally {
        damageSystem.destroy();
      }
    });

    it('artifact counter-attack 应将反击伤害发送给 event.caster 而非 owner 自身', () => {
      const translator = new AffixEffectTranslator();
      const def = DEFAULT_AFFIX_REGISTRY.queryById('artifact-suffix-counter-attack');

      expect(def).toBeDefined();
      expect(def?.listenerSpec?.mapping).toEqual({
        caster: 'owner',
        target: 'event.caster',
      });

      const attacker = new Unit('counter-attacker', '进攻者', {
        [BattleAttributeType.SPIRIT]: 100,
        [BattleAttributeType.VITALITY]: 100,
        [BattleAttributeType.SPEED]: 100,
        [BattleAttributeType.WILLPOWER]: 100,
        [BattleAttributeType.WISDOM]: 100,
      });
      const defender = new Unit('counter-defender', '反制者', {
        [BattleAttributeType.SPIRIT]: 100,
        [BattleAttributeType.VITALITY]: 100,
        [BattleAttributeType.SPEED]: 100,
        [BattleAttributeType.WILLPOWER]: 100,
        [BattleAttributeType.WISDOM]: 100,
      });

      const captured: DamageRequestEvent[] = [];
      const onDamageRequest = (event: DamageRequestEvent) => {
        captured.push(event);
      };

      EventBus.instance.subscribe<DamageRequestEvent>(
        'DamageRequestEvent',
        onDamageRequest,
        999,
      );

      try {
        defender.abilities.addAbility(
          AbilityFactory.create({
            slug: 'artifact_counter_attack_test',
            name: '反制之舞',
            type: BattleAbilityType.PASSIVE_SKILL,
            listeners: [
              {
                id: 'artifact_counter_attack_listener',
                eventType: def!.listenerSpec!.eventType,
                scope: def!.listenerSpec!.scope,
                priority: def!.listenerSpec!.priority,
                mapping: { ...def!.listenerSpec!.mapping! },
                effects: [translator.translate(def!, '玄品')],
              },
            ],
          }),
        );

        EventBus.instance.publish<DamageTakenEvent>({
          type: 'DamageTakenEvent',
          timestamp: Date.now(),
          caster: attacker,
          target: defender,
          damageTaken: 120,
          remainHp: defender.getCurrentHp(),
          isLethal: false,
          beforeHp: defender.getCurrentHp() + 120,
        });

        expect(captured).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              caster: defender,
              target: attacker,
            }),
          ]),
        );
      } finally {
        EventBus.instance.unsubscribe<DamageRequestEvent>(
          'DamageRequestEvent',
          onDamageRequest,
        );
      }
    });
  });
});
