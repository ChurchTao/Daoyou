import { describe, expect, it } from '@jest/globals';
import { DEFAULT_AFFIX_REGISTRY } from '@/engine/creation-v2/affixes';
import { AffixEffectTranslator } from '@/engine/creation-v2/affixes/AffixEffectTranslator';
import type { AffixDefinition } from '@/engine/creation-v2/affixes/types';
import { AttributeType, BuffType } from '@/engine/creation-v2/contracts/battle';
import { GameplayTags } from '@/engine/shared/tag-domain';
import { assembleAbilityTags } from '@/engine/creation-v2/rules/composition/AbilityTagAssembler';
import type { RolledAffix } from '@/engine/creation-v2/types';

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
    tags: def.tagQuery,
    runtimeSemantics: def.runtimeSemantics,
    exclusiveGroup: def.exclusiveGroup,
  };
}

describe('AbilityTagAssembler', () => {
  const translator = new AffixEffectTranslator();

  it('应拒绝没有主角色标签的 skill 投影', () => {
    expect(() =>
      assembleAbilityTags({
        productType: 'skill',
        effects: [
          {
            type: 'shield',
            params: {
              value: {
                base: 20,
                attribute: AttributeType.SPIRIT,
                coefficient: 0.2,
              },
            },
          },
        ],
      }),
    ).toThrow(
      '技能产物必须声明至少一个核心功能标签',
    );
  });

  it('应拒绝缺少显式伤害属性的 damage effect', () => {
    // 注意：重构后由于采用了聚合模式，单纯的推导报错可能会因为校验逻辑的微调而消失或改变
    // 这里的测试用例应确保在只有 effect 推导时，仍能命中或正确拦截
    expect(() =>
      assembleAbilityTags({
        productType: 'skill',
        effects: [
          {
            type: 'damage',
            params: {
              value: {
                base: 20,
              },
            },
          },
        ],
      }),
    ).toThrow();
  });

  it('应为控制型 artifact listener 产出 kind 与 control 标签', () => {
    const tags = assembleAbilityTags({
      productType: 'artifact',
      listeners: [
        {
          eventType: GameplayTags.EVENT.SKILL_CAST,
          scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
          priority: 10,
          effects: [
            {
              type: 'apply_buff',
              params: {
                buffConfig: {
                  id: 'test-control-buff',
                  name: '禁锢',
                  type: BuffType.CONTROL,
                  duration: 1,
                  stackRule: 'override',
                },
              },
            },
          ],
        },
      ],
    });

    expect(tags).toEqual(
      expect.arrayContaining([
        GameplayTags.ABILITY.KIND.ARTIFACT,
        GameplayTags.ABILITY.FUNCTION.CONTROL,
      ]),
    );
  });

  it('应让 skill 治疗核心产出 heal 而不是遗留 damage 标签', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('skill-core-heal');
    expect(def).toBeDefined();

    const rolled = toRolledAffix(def!);
    const effect = translator.translate(rolled, '灵品');

    const tags = assembleAbilityTags({
      productType: 'skill',
      rolledAffixes: [rolled],
      effects: [effect],
      registry: DEFAULT_AFFIX_REGISTRY,
    });

    expect(tags).toContain(GameplayTags.ABILITY.FUNCTION.HEAL);
    expect(tags).not.toContain(GameplayTags.ABILITY.FUNCTION.DAMAGE);
  });

  it('应让 skill 控制核心产出 control 而不是遗留 damage 标签', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('skill-core-control-stun');
    expect(def).toBeDefined();

    const rolled = toRolledAffix(def!);
    const effect = translator.translate(rolled, '灵品');

    const tags = assembleAbilityTags({
      productType: 'skill',
      rolledAffixes: [rolled],
      effects: [effect],
      registry: DEFAULT_AFFIX_REGISTRY,
    });

    expect(tags).toContain(GameplayTags.ABILITY.FUNCTION.CONTROL);
    expect(tags).not.toContain(GameplayTags.ABILITY.FUNCTION.DAMAGE);
  });

  it('应让 artifact 核心经 runtimeSemantics 投影出 passive 与 artifact kind', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('artifact-core-weapon-dual-edge');
    expect(def).toBeDefined();
    expect(def?.runtimeSemantics).toEqual({ kind: 'passive' });

    const tags = assembleAbilityTags({
      productType: 'artifact',
      rolledAffixes: [toRolledAffix(def!)],
      registry: DEFAULT_AFFIX_REGISTRY,
    });

    expect(tags).toEqual(
      expect.arrayContaining([
        GameplayTags.ABILITY.KIND.PASSIVE,
        GameplayTags.ABILITY.KIND.ARTIFACT,
      ]),
    );
  });

  it('应让 gongfa 核心经 runtimeSemantics 投影出 passive 与 gongfa kind', () => {
    const def = DEFAULT_AFFIX_REGISTRY.queryById('gongfa-core-spirit');
    expect(def).toBeDefined();
    expect(def?.runtimeSemantics).toEqual({ kind: 'passive' });

    const tags = assembleAbilityTags({
      productType: 'gongfa',
      rolledAffixes: [toRolledAffix(def!)],
      registry: DEFAULT_AFFIX_REGISTRY,
    });

    expect(tags).toEqual(
      expect.arrayContaining([
        GameplayTags.ABILITY.KIND.PASSIVE,
        GameplayTags.ABILITY.KIND.GONGFA,
      ]),
    );
  });
});
