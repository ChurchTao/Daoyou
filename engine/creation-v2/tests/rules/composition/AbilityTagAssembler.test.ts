import { describe, expect, it } from '@jest/globals';
import { AttributeType, BuffType } from '@/engine/creation-v2/contracts/battle';
import { GameplayTags } from '@/engine/battle-v5/core/GameplayTags';
import { assembleAbilityTags } from '@/engine/creation-v2/rules/composition/AbilityTagAssembler';

describe('AbilityTagAssembler', () => {
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
    // 这里的测试用例应确保在没有 inherentTags 的情况下，推导仍能命中或正确拦截
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
        GameplayTags.ABILITY.KIND_ARTIFACT,
        GameplayTags.ABILITY.TYPE_CONTROL,
      ]),
    );
  });
});
