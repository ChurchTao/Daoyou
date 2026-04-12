import { describe, expect, it } from '@jest/globals';
import { GameplayTags } from '@/engine/shared/tag-domain';
import { assembleAbilityTags } from '@/engine/creation-v2/rules/composition/AbilityTagAssembler';
import type { RolledAffix } from '@/engine/creation-v2/types';

function buildRolledAffix(
  id: string,
  grantedAbilityTags: string[] = [],
): RolledAffix {
  return {
    id,
    name: id,
    category: 'core',
    energyCost: 1,
    rollScore: 1,
    rollEfficiency: 1,
    finalMultiplier: 1,
    isPerfect: false,
    weight: 1,
    match: {},
    tags: [],
    effectTemplate: {
      type: 'damage',
      params: {
        value: { base: 10 },
      },
    },
    grantedAbilityTags,
  } as RolledAffix;
}

describe('AbilityTagAssembler', () => {
  it('应拒绝没有核心功能标签的 skill 投影', () => {
    expect(() =>
      assembleAbilityTags({
        productType: 'skill',
      }),
    ).toThrow('技能产物必须声明至少一个核心功能标签');
  });

  it('应直接合并抽中的 affix grantedAbilityTags，并补 skill kind', () => {
    const tags = assembleAbilityTags({
      productType: 'skill',
      rolledAffixes: [
        buildRolledAffix('skill-core-damage', [
          GameplayTags.ABILITY.FUNCTION.DAMAGE,
          GameplayTags.ABILITY.CHANNEL.MAGIC,
        ]),
        buildRolledAffix('skill-suffix-lifesteal', [GameplayTags.TRAIT.LIFESTEAL]),
      ],
    });

    expect(tags).toEqual(
      expect.arrayContaining([
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.MAGIC,
        GameplayTags.TRAIT.LIFESTEAL,
        GameplayTags.ABILITY.KIND.SKILL,
      ]),
    );
  });

  it('应去重重复的 affix ability tags，并补 elementBias', () => {
    const tags = assembleAbilityTags({
      productType: 'skill',
      rolledAffixes: [
        buildRolledAffix('skill-core-damage-a', [
          GameplayTags.ABILITY.FUNCTION.DAMAGE,
          GameplayTags.ABILITY.CHANNEL.MAGIC,
        ]),
        buildRolledAffix('skill-core-damage-b', [
          GameplayTags.ABILITY.FUNCTION.DAMAGE,
          GameplayTags.ABILITY.CHANNEL.MAGIC,
        ]),
      ],
      elementBias: '火',
    });

    expect(
      tags.filter((tag) => tag === GameplayTags.ABILITY.FUNCTION.DAMAGE),
    ).toHaveLength(1);
    expect(
      tags.filter((tag) => tag === GameplayTags.ABILITY.CHANNEL.MAGIC),
    ).toHaveLength(1);
    expect(tags).toContain(GameplayTags.ABILITY.ELEMENT.FIRE);
  });

  it('应在 creation 投影阶段拒绝 mixed damage channels', () => {
    expect(() =>
      assembleAbilityTags({
        productType: 'skill',
        rolledAffixes: [
          buildRolledAffix('skill-core-magic', [
            GameplayTags.ABILITY.FUNCTION.DAMAGE,
            GameplayTags.ABILITY.CHANNEL.MAGIC,
          ]),
          buildRolledAffix('skill-core-physical', [
            GameplayTags.ABILITY.FUNCTION.DAMAGE,
            GameplayTags.ABILITY.CHANNEL.PHYSICAL,
          ]),
        ],
      }),
    ).toThrow('ability projection cannot mix multiple damage channels');
  });

  it('artifact 与 gongfa 只补自身 product kind，不再附带 passive kind', () => {
    const artifactTags = assembleAbilityTags({
      productType: 'artifact',
      rolledAffixes: [buildRolledAffix('artifact-core')],
    });
    const gongfaTags = assembleAbilityTags({
      productType: 'gongfa',
      rolledAffixes: [buildRolledAffix('gongfa-core')],
    });

    expect(artifactTags).toContain(GameplayTags.ABILITY.KIND.ARTIFACT);
    expect(gongfaTags).toContain(GameplayTags.ABILITY.KIND.GONGFA);
    expect(artifactTags).not.toContain(GameplayTags.ABILITY.KIND.PASSIVE);
    expect(gongfaTags).not.toContain(GameplayTags.ABILITY.KIND.PASSIVE);
  });
});
