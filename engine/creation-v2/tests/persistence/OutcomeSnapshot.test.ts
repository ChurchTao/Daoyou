import { GameplayTags } from '@/engine/shared/tag-domain';
import { AbilityType, AttributeType } from '@/engine/creation-v2/contracts/battle';
import { projectAbilityConfig } from '@/engine/creation-v2/models';
import type { CreationOutcomeMaterializer } from '@/engine/creation-v2/adapters/types';
import type { CraftedOutcome, CreationBlueprint } from '@/engine/creation-v2/types';
import {
  assertSnapshotShape,
  restoreCraftedOutcome,
  snapshotCraftedOutcome,
  serializeCraftedOutcomeSnapshot,
  deserializeCraftedOutcomeSnapshot,
  type CraftedOutcomeSnapshot,
} from '@/engine/creation-v2/persistence/OutcomeSnapshot';

function createSkillBlueprint(): CreationBlueprint {
  return {
    outcomeKind: 'active_skill',
    productModel: {
      productType: 'skill',
      outcomeKind: 'active_skill',
      slug: 'craft-v2-snapshot-test',
      name: '试炼决',
      description: '用于快照测试的技能。',
      outcomeTags: ['Outcome.ActiveSkill'],
      affixes: [],
      battleProjection: {
        projectionKind: 'active_skill',
        abilityTags: [
          GameplayTags.ABILITY.FUNCTION.DAMAGE,
          GameplayTags.ABILITY.CHANNEL.MAGIC,
        ],
        mpCost: 10,
        cooldown: 2,
        priority: 10,
        targetPolicy: { team: 'enemy', scope: 'single' },
        effects: [
          {
            type: 'damage',
            params: {
              value: {
                base: 15,
                attribute: AttributeType.MAGIC_ATK,
                coefficient: 0,
              },
            },
          },
        ],
      },
    },
  };
}

function createStubOutcome(): CraftedOutcome {
  const blueprint = createSkillBlueprint();
  return {
    blueprint,
    ability: {
      type: AbilityType.ACTIVE_SKILL,
      name: '试炼决',
    } as ReturnType<CreationOutcomeMaterializer['materialize']>['ability'],
  };
}

function createStubMaterializer(): CreationOutcomeMaterializer {
  return {
    materialize(_productType, blueprint): CraftedOutcome {
      return {
        blueprint,
        ability: {
          type: AbilityType.ACTIVE_SKILL,
          name: blueprint.productModel.name,
        } as ReturnType<CreationOutcomeMaterializer['materialize']>['ability'],
      };
    },
  };
}

describe('snapshotCraftedOutcome', () => {
  it('应提取 productType / outcomeKind / blueprint / productModel / abilityConfig', () => {
    const outcome = createStubOutcome();
    const snapshot = snapshotCraftedOutcome(outcome);

    expect(snapshot.productType).toBe('skill');
    expect(snapshot.outcomeKind).toBe('active_skill');
    expect(snapshot.blueprint).toBe(outcome.blueprint);
    expect(snapshot.productModel).toBe(outcome.blueprint.productModel);
    expect(snapshot.abilityConfig).toStrictEqual(projectAbilityConfig(outcome.blueprint.productModel));
  });
});

describe('restoreCraftedOutcome', () => {
  it('应通过 stub materializer 还原出与快照一致的字段', () => {
    const outcome = createStubOutcome();
    const snapshot = snapshotCraftedOutcome(outcome);
    const materializer = createStubMaterializer();

    const restored = restoreCraftedOutcome(snapshot, materializer);

    expect(restored.blueprint.outcomeKind).toBe(snapshot.outcomeKind);
    expect(restored.blueprint.productModel.productType).toBe(snapshot.productModel.productType);
    expect(restored.blueprint.productModel.slug).toBe(snapshot.productModel.slug);
    expect(restored.blueprint.productModel.name).toBe(snapshot.productModel.name);
  });

  it('应在快照与 materializer 返回的 outcomeKind 不一致时抛出', () => {
    const outcome = createStubOutcome();
    const snapshot = snapshotCraftedOutcome(outcome);

    const tamperedMaterializer: CreationOutcomeMaterializer = {
      materialize(_productType, blueprint): CraftedOutcome {
        return {
          blueprint: { ...blueprint, outcomeKind: 'artifact' },
          ability: {
            type: AbilityType.PASSIVE_SKILL,
            name: blueprint.productModel.name,
          } as ReturnType<CreationOutcomeMaterializer['materialize']>['ability'],
        };
      },
    };

    expect(() => restoreCraftedOutcome(snapshot, tamperedMaterializer)).toThrow(
      'Persisted outcome snapshot identity fields do not match current projection contract',
    );
  });
});

describe('assertSnapshotShape', () => {
  it('应在快照合法时不抛出', () => {
    const outcome = createStubOutcome();
    const snapshot = snapshotCraftedOutcome(outcome);

    expect(() => assertSnapshotShape(snapshot)).not.toThrow();
  });

  it('应在缺少 productType / outcomeKind 时抛出', () => {
    const partial = { blueprint: {}, productModel: {}, abilityConfig: {} } as unknown as CraftedOutcomeSnapshot;

    expect(() => assertSnapshotShape(partial)).toThrow(
      'Crafted outcome snapshot is missing identity fields',
    );
  });

  it('应在缺少 blueprint / productModel / abilityConfig 时抛出', () => {
    const partial = {
      productType: 'skill',
      outcomeKind: 'active_skill',
    } as unknown as CraftedOutcomeSnapshot;

    expect(() => assertSnapshotShape(partial)).toThrow(
      'Crafted outcome snapshot is missing projection fields',
    );
  });

  it('应在传入非对象时抛出', () => {
    expect(() => assertSnapshotShape(null as unknown as CraftedOutcomeSnapshot)).toThrow(
      'Invalid crafted outcome snapshot payload',
    );
  });
});

describe('序列化/反序列化往返', () => {
  it('应在序列化后反序列化保持数据一致', () => {
    const outcome = createStubOutcome();
    const snapshot = snapshotCraftedOutcome(outcome);
    const json = serializeCraftedOutcomeSnapshot(snapshot);
    const restored = deserializeCraftedOutcomeSnapshot(json);

    expect(restored.productType).toBe(snapshot.productType);
    expect(restored.outcomeKind).toBe(snapshot.outcomeKind);
    expect(restored.productModel.slug).toBe(snapshot.productModel.slug);
  });
});
