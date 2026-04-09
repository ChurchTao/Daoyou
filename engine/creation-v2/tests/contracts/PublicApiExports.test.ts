import * as creationV2 from '@/engine/creation-v2';
import * as battleContract from '@/engine/creation-v2/contracts/battle';
import * as battleTestkit from '@/engine/creation-v2/contracts/battle-testkit';
import { CreationTags } from '@/engine/creation-v2/core/GameplayTags';
import { projectAbilityConfig } from '@/engine/creation-v2/models';
import type {
  ActiveSkillBattleProjection,
  ArtifactProductModel,
  CreationProductModel,
  GongFaProductModel,
  SkillProductModel,
} from '@/engine/creation-v2/models';

import type {
  CompositionDecision,
  MaterialFacts,
  RecipeDecision,
  RuleDecisionMeta,
} from '@/engine/creation-v2';

describe('creation-v2 public exports', () => {
  it('不应继续暴露遗留 DefaultBlueprintComposer', () => {
    expect('DefaultBlueprintComposer' in creationV2).toBe(false);
  });

  it('应暴露规则骨架运行时入口', () => {
    expect(creationV2.RuleSet).toBeDefined();
    expect(creationV2.RuleDiagnostics).toBeDefined();
  });

  it('应继续暴露当前受支持的模型导出', () => {
    expect(projectAbilityConfig).toBeDefined();

    const projection: ActiveSkillBattleProjection = {
      projectionKind: 'active_skill',
      abilityTags: ['Ability.Type.Damage', 'Ability.Type.Magic'],
      mpCost: 10,
      cooldown: 2,
      priority: 10,
      targetPolicy: {
        team: 'enemy',
        scope: 'single',
      },
      effects: [],
    };

    const skillModel: SkillProductModel = {
      productType: 'skill',
      outcomeKind: 'active_skill',
      slug: 'public-api-skill',
      name: '测试技能',
      tags: [],
      affixes: [],
      battleProjection: projection,
    };

    const artifactModel: ArtifactProductModel = {
      productType: 'artifact',
      outcomeKind: 'artifact',
      slug: 'public-api-artifact',
      name: '测试法宝',
      tags: [],
      affixes: [],
      artifactConfig: {
        equipPolicy: 'single_slot',
        persistencePolicy: 'inventory_bound',
        progressionPolicy: 'reforgeable',
      },
      battleProjection: {
        projectionKind: 'artifact_passive',
        abilityTags: [CreationTags.BATTLE.ABILITY_KIND_ARTIFACT],
        listeners: [],
      },
    };

    const gongfaModel: GongFaProductModel = {
      productType: 'gongfa',
      outcomeKind: 'gongfa',
      slug: 'public-api-gongfa',
      name: '测试功法',
      tags: [],
      affixes: [],
      gongfaConfig: {
        equipPolicy: 'single_manual',
        persistencePolicy: 'inventory_bound',
        progressionPolicy: 'comprehension',
      },
      battleProjection: {
        projectionKind: 'gongfa_passive',
        abilityTags: [CreationTags.BATTLE.ABILITY_KIND_GONGFA],
        listeners: [],
      },
    };

    const models: CreationProductModel[] = [skillModel, artifactModel, gongfaModel];

    expect(models).toHaveLength(3);
  });

  it('应提供 facts 与 decisions 的类型导出', () => {
    const materialFacts: MaterialFacts = {
      productType: 'skill',
      fingerprints: [],
      normalizedTags: ['Element.Fire'],
      recipeTags: ['Recipe.ProductBias.Skill'],
      requestedTags: ['burst'],
      dominantTags: ['Element.Fire'],
      energyProfile: {
        baseEnergy: 18,
        diversityBonus: 0,
        coherenceBonus: 0,
        effectiveEnergy: 18,
        unlockScore: 16,
      },
      qualityProfile: {
        maxQuality: '凡品',
        weightedAverageQuality: '凡品',
        minQuality: '凡品',
        maxQualityOrder: 0,
        weightedAverageOrder: 0,
        minQualityOrder: 0,
        qualitySpread: 0,
        totalQuantity: 0,
      },
      unlockScore: 16,
    };

    const baseMeta: RuleDecisionMeta = {
      reasons: [],
      warnings: [],
      trace: [],
    };

    const recipeDecision: RecipeDecision = {
      ...baseMeta,
      recipeId: 'skill-default',
      valid: true,
      matchedTags: ['Element.Fire'],
      unlockedAffixCategories: ['core', 'prefix'],
      reservedEnergy: 6,
      notes: [],
    };

    const compositionDecision: CompositionDecision = {
      ...baseMeta,
      outcomeKind: 'active_skill',
      name: '赤炎诀',
      tags: ['Element.Fire'],
      affixes: [],
      defaultsApplied: ['damage_projection'],
    };

    expect(materialFacts.energyProfile.effectiveEnergy).toBe(18);
    expect(materialFacts.unlockScore).toBe(16);
    expect(recipeDecision.valid).toBe(true);
    expect(compositionDecision.outcomeKind).toBe('active_skill');
  });

  it('应将 battle 运行时契约与测试运行时对象分离', () => {
    expect('EventBus' in battleContract).toBe(false);
    expect('Unit' in battleContract).toBe(false);
    expect('Buff' in battleContract).toBe(false);

    expect('EventBus' in battleTestkit).toBe(true);
    expect('Unit' in battleTestkit).toBe(true);
    expect('Buff' in battleTestkit).toBe(true);
  });
});