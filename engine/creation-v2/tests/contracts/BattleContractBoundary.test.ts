import { TestableCreationOrchestrator as CreationOrchestrator } from '@/engine/creation-v2/tests/helpers/TestableCreationOrchestrator';
import { runCreationBattleDuel } from '@/engine/creation-v2/tests/helpers/BattleRegressionHarness';
import { projectAbilityConfig } from '@/engine/creation-v2/models';
import { AbilityType } from '@/engine/creation-v2/contracts/battle';
import { EventBus } from '@/engine/creation-v2/contracts/battle-testkit';
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
  orchestrator.buildAffixPool(session, []);
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
  orchestrator.buildAffixPool(session, []);
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
  });
});
