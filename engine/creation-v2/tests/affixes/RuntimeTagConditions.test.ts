import { describe, expect, it } from '@jest/globals';
import { AffixEffectTranslator } from '@/engine/creation-v2/affixes/AffixEffectTranslator';
import { DEFAULT_AFFIX_REGISTRY } from '@/engine/creation-v2/affixes';
import { CreationTags } from '@/engine/creation-v2/core/GameplayTags';

describe('creation-v2 affix tagQuery contract', () => {
  const translator = new AffixEffectTranslator();

  it('queryByTags 应仅依赖静态筛选标签，避免候选池不可达', () => {
    const candidates = DEFAULT_AFFIX_REGISTRY.queryByTags(
      [
        CreationTags.MATERIAL.SEMANTIC_POISON,
        CreationTags.MATERIAL.SEMANTIC_THUNDER,
      ],
      ['synergy'],
      'skill',
    );

    expect(candidates.map((candidate) => candidate.id)).toContain(
      'skill-synergy-debuff-stack',
    );
  });

  it('tagQuery 不应再包含运行时派生标签', () => {
    const offenders = DEFAULT_AFFIX_REGISTRY.getAll().filter((def) =>
      def.tagQuery.some(
        (tag) =>
          tag.startsWith(`${CreationTags.SCENARIO.ROOT}.`) ||
          tag.startsWith(`${CreationTags.EFFECT.ROOT}.`),
      ),
    );

    expect(offenders).toEqual([]);
  });

  it('控制相关共鸣应显式声明 ability_has_tag 条件', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('skill-resonance-control-mastery');
    expect(def).toBeDefined();

    const result = translator.translate(def!, '玄品');

    expect(result.conditions).toEqual([
      {
        type: 'ability_has_tag',
        params: { tag: CreationTags.BATTLE.ABILITY_TYPE_CONTROL },
      },
    ]);
  });

  it('多 debuff 协同应显式声明 debuff_count_at_least 条件', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('skill-synergy-debuff-stack');
    expect(def).toBeDefined();

    const result = translator.translate(def!, '玄品');

    expect(result.conditions).toEqual([
      {
        type: 'debuff_count_at_least',
        params: { value: 2 },
      },
    ]);
  });

  it('控制联动增伤应同时声明能力标签与目标状态条件', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('skill-synergy-control-damage');
    expect(def).toBeDefined();

    const result = translator.translate(def!, '真品');

    expect(result.conditions).toEqual([
      {
        type: 'ability_has_tag',
        params: { tag: CreationTags.BATTLE.ABILITY_TYPE_CONTROL },
      },
      {
        type: 'has_tag',
        params: { tag: CreationTags.BATTLE.STATUS_CONTROL },
      },
    ]);
  });
});