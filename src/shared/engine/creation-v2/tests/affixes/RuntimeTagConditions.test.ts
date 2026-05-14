import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { describe, expect, it } from 'vitest';
import { AffixEffectTranslator } from '@shared/engine/creation-v2/affixes/AffixEffectTranslator';
import { DEFAULT_AFFIX_REGISTRY } from '@shared/engine/creation-v2/affixes';
import { SKILL_AFFIXES } from '@shared/engine/creation-v2/affixes/definitions/skillAffixes';
import { ELEMENT_TO_MATERIAL_TAG } from '@shared/engine/creation-v2/config/CreationMappings';
import { collectAffixMatcherReferencedTags } from '@shared/engine/creation-v2/affixes';
import { CreationTags } from '@shared/engine/shared/tag-domain';
import { RolledAffix } from '@shared/engine/creation-v2/types';

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

  it('默认 skill 词条不应再包含 listenerSpec 或被动式 effect 类型', () => {
    const offenders = SKILL_AFFIXES.filter(
      (def) =>
        !!def.listenerSpec ||
        def.effectTemplate.type === 'percent_damage_modifier' ||
        def.effectTemplate.type === 'resource_drain',
    );

    expect(offenders).toEqual([]);
  });
});
