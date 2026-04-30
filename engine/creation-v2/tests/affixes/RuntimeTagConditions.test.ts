import { GameplayTags } from '@/engine/shared/tag-domain';
import { describe, expect, it } from '@jest/globals';
import { AffixEffectTranslator } from '@/engine/creation-v2/affixes/AffixEffectTranslator';
import { DEFAULT_AFFIX_REGISTRY } from '@/engine/creation-v2/affixes';
import { ELEMENT_TO_MATERIAL_TAG } from '@/engine/creation-v2/config/CreationMappings';
import {
  collectAffixMatcherReferencedTags,
  flattenAffixMatcherTags,
} from '@/engine/creation-v2/affixes';
import { CreationTags } from '@/engine/shared/tag-domain';
import { RolledAffix } from '@/engine/creation-v2/types';
import type { AffixDefinition } from '@/engine/creation-v2/affixes/types';

/** 辅助函数：将静态定义转换为运行态 RolledAffix 以满足接口契约 */
function toRolledAffix(def: AffixDefinition): RolledAffix {
  return {
    id: def.id,
    name: def.displayName,
    category: def.category,
    energyCost: def.energyCost,
    rollScore: 1,
    rollEfficiency: 1,
    finalMultiplier: 1,
    isPerfect: false,
    effectTemplate: def.effectTemplate,
    weight: def.weight,
    match: def.match,
    tags: flattenAffixMatcherTags(def.match),
    exclusiveGroup: def.exclusiveGroup,
  };
}

describe('creation-v2 affix match contract', () => {
  const translator = new AffixEffectTranslator();

  it('queryByTags 应仅依赖静态筛选标签，避免候选池不可达', () => {
    const candidates = DEFAULT_AFFIX_REGISTRY.queryByTags(
      [
        ELEMENT_TO_MATERIAL_TAG['木'],
        CreationTags.MATERIAL.SEMANTIC_POISON,
        CreationTags.MATERIAL.SEMANTIC_THUNDER,
      ],
      ['skill_variant'],
      'skill',
    );

    expect(candidates.map((candidate) => candidate.id)).toContain(
      'skill-variant-poison-dot',
    );
  });

  it('match 不应再包含运行时派生标签', () => {
    const offenders = DEFAULT_AFFIX_REGISTRY.getAll().filter((def) =>
      collectAffixMatcherReferencedTags(def.match).some(
        (tag) =>
          tag.startsWith('Condition.') ||
          tag.startsWith('Trait.') ||
          tag.startsWith('Ability.') ||
          tag.startsWith('Status.'),
      ),
    );

    expect(offenders).toEqual([]);
  });

  it('控制相关共鸣应显式声明 ability_has_tag 条件', () => {
    const rolledAffix: RolledAffix = {
      id: 'test-control-mastery',
      name: '控制共鸣',
      category: 'skill_variant',
      energyCost: 8,
      rollScore: 1,
      rollEfficiency: 1,
      finalMultiplier: 1,
      isPerfect: false,
      weight: 10,
      match: {},
      tags: [],
      effectTemplate: {
        type: 'percent_damage_modifier',
        conditions: [
          {
            type: 'ability_has_tag',
            params: { tag: GameplayTags.ABILITY.FUNCTION.CONTROL },
          },
        ],
        params: { mode: 'increase', value: 0.2, cap: 1.0 },
      },
    };
    const result = translator.translate(rolledAffix, '玄品');

    expect(result.conditions).toEqual([
      {
        type: 'ability_has_tag',
        params: { tag: GameplayTags.ABILITY.FUNCTION.CONTROL },
      },
    ]);
  });

  it('多 debuff 协同应显式声明 debuff_count_at_least 条件', () => {
    const rolledAffix: RolledAffix = {
      id: 'test-debuff-stack',
      name: 'debuff协同',
      category: 'skill_rare',
      energyCost: 10,
      rollScore: 1,
      rollEfficiency: 1,
      finalMultiplier: 1,
      isPerfect: false,
      weight: 10,
      match: {},
      tags: [],
      effectTemplate: {
        type: 'percent_damage_modifier',
        conditions: [
          {
            type: 'debuff_count_at_least',
            params: { value: 2 },
          },
        ],
        params: { mode: 'increase', value: 0.25, cap: 1.0 },
      },
    };
    const result = translator.translate(rolledAffix, '玄品');

    expect(result.conditions).toEqual([
      {
        type: 'debuff_count_at_least',
        params: { value: 2 },
      },
    ]);
  });

  it('控制联动增伤应声明目标状态条件', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('skill-rare-throat-seal');
    expect(def).toBeDefined();

    const result = translator.translate(toRolledAffix(def!), '真品');

    expect(result.conditions).toEqual([
      {
        type: 'has_tag',
        params: { tag: GameplayTags.STATUS.CONTROL.ROOT },
      },
    ]);
  });
});
