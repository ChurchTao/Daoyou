import type { Ability } from '@/engine/creation-v2/contracts/battle';
import { AbilityType, AttributeType } from '@/engine/creation-v2/contracts/battle';
import { CreationAbilityAdapter } from '@/engine/creation-v2/adapters/CreationAbilityAdapter';
import type { CreationAbilityBuilder } from '@/engine/creation-v2/adapters/types';
import type { CreationBlueprint } from '@/engine/creation-v2/types';

function createSkillBlueprint(): CreationBlueprint {
  return {
    outcomeKind: 'active_skill',
    productModel: {
      productType: 'skill',
      outcomeKind: 'active_skill',
      slug: 'craft-v2-skill-test',
      name: '焚岳诀',
      description: '将烈焰压缩成一线，瞬间焚穿敌躯。',
      tags: ['Outcome.ActiveSkill'],
      affixes: [],
      battleProjection: {
        projectionKind: 'active_skill',
        abilityTags: [
          'Ability.Type.Damage',
          'Ability.Type.Magic',
          'Ability.Element.Fire',
        ],
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
                attribute: AttributeType.MAGIC_ATK,
                coefficient: 0.8,
              },
            },
          },
        ],
      },
    },
  };
}

describe('CreationAbilityAdapter', () => {
  it('应通过注入的 builder 物化投影后的 ability config', () => {
    const build = jest.fn((config) => ({
      id: config.slug,
      name: config.name,
      type: config.type,
    })) as unknown as jest.MockedFunction<CreationAbilityBuilder['build']>;
    const adapter = new CreationAbilityAdapter({ build });
    const blueprint = createSkillBlueprint();

    const outcome = adapter.materialize('skill', blueprint);

    expect(build).toHaveBeenCalledTimes(1);
    expect(build).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'craft-v2-skill-test',
        type: AbilityType.ACTIVE_SKILL,
      }),
    );
    expect(outcome.ability).toMatchObject({
      name: '焚岳诀',
      type: AbilityType.ACTIVE_SKILL,
    });
  });

  it('应在 outcomeKind 与投影能力类型不一致时显式失败，并且不调用 builder', () => {
    const build = jest.fn(() => ({
      id: 'should-not-build',
      name: 'should-not-build',
      type: AbilityType.ACTIVE_SKILL,
    })) as unknown as jest.MockedFunction<CreationAbilityBuilder['build']>;
    const adapter = new CreationAbilityAdapter({ build });
    const blueprint = {
      ...createSkillBlueprint(),
      outcomeKind: 'artifact',
    } as CreationBlueprint;

    expect(() => adapter.materialize('skill', blueprint)).toThrow(
      'Blueprint outcome kind artifact does not match projected ability type active_skill',
    );
    expect(build).not.toHaveBeenCalled();
  });

  it('应基于能力 type 判断主动与被动能力', () => {
    const adapter = new CreationAbilityAdapter({
      build: jest.fn(),
    });

    expect(
      adapter.isActiveSkill({ type: AbilityType.ACTIVE_SKILL } as Ability),
    ).toBe(true);
    expect(
      adapter.isActiveSkill({ type: AbilityType.PASSIVE_SKILL } as Ability),
    ).toBe(false);
    expect(
      adapter.isPassiveAbility({ type: AbilityType.PASSIVE_SKILL } as Ability),
    ).toBe(true);
    expect(
      adapter.isPassiveAbility({ type: AbilityType.ACTIVE_SKILL } as Ability),
    ).toBe(false);
  });
});