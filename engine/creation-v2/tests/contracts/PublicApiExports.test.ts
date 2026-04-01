import * as creationV2 from '@/engine/creation-v2';
import * as battleContract from '@/engine/creation-v2/contracts/battle';
import * as battleTestkit from '@/engine/creation-v2/contracts/battle-testkit';
import { projectAbilityConfig } from '@/engine/creation-v2/models';
import type {
  ActiveSkillBattleProjection,
  ArtifactProductModel,
  CreationProductModel,
  GongFaProductModel,
  SkillProductModel,
} from '@/engine/creation-v2/models';

describe('creation-v2 public exports', () => {
  it('不应继续暴露遗留 DefaultBlueprintComposer', () => {
    expect('DefaultBlueprintComposer' in creationV2).toBe(false);
  });

  it('应继续暴露当前受支持的模型导出', () => {
    expect(projectAbilityConfig).toBeDefined();

    const projection: ActiveSkillBattleProjection = {
      projectionKind: 'active_skill',
      abilityTags: ['Ability.Type.Damage'],
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
      abilityTags: projection.abilityTags,
      mpCost: projection.mpCost,
      cooldown: projection.cooldown,
      priority: projection.priority,
      targetPolicy: projection.targetPolicy,
      effects: projection.effects,
      battleProjection: projection,
    };

    const artifactModel: ArtifactProductModel = {
      productType: 'artifact',
      outcomeKind: 'artifact',
      slug: 'public-api-artifact',
      name: '测试法宝',
      tags: [],
      affixes: [],
      abilityTags: ['Artifact'],
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
        abilityTags: ['Artifact'],
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
      abilityTags: ['GongFa'],
      equipPolicy: 'single_manual',
      persistencePolicy: 'inventory_bound',
      progressionPolicy: 'comprehension',
      gongfaConfig: {
        equipPolicy: 'single_manual',
        persistencePolicy: 'inventory_bound',
        progressionPolicy: 'comprehension',
      },
      battleProjection: {
        projectionKind: 'gongfa_passive',
        abilityTags: ['GongFa'],
        listeners: [],
      },
    };

    const models: CreationProductModel[] = [skillModel, artifactModel, gongfaModel];

    expect(models).toHaveLength(3);
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