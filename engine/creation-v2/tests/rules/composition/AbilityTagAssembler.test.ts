import { describe, expect, it } from '@jest/globals';
import { AttributeType, BuffType } from '@/engine/creation-v2/contracts/battle';
import { CreationTags } from '@/engine/creation-v2/core/GameplayTags';
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
      '[AbilityTagAssembler] skill projection must declare at least one primary ability role',
    );
  });

  it('应拒绝缺少显式伤害属性的 damage effect', () => {
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
    ).toThrow(
      '[AbilityTagAssembler] damage effect is missing an explicit damage attribute',
    );
  });

  it('应为控制型 artifact listener 产出 kind 与 control 标签', () => {
    const tags = assembleAbilityTags({
      productType: 'artifact',
      listeners: [
        {
          eventType: CreationTags.BATTLE_EVENT.SKILL_CAST,
          scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
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
        CreationTags.BATTLE.ABILITY_KIND_ARTIFACT,
        CreationTags.BATTLE.ABILITY_TYPE_CONTROL,
      ]),
    );
  });
});