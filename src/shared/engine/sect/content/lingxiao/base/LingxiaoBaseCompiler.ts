import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import type {
  AttributeModifierConfig,
  EffectConfig,
  ListenerConfig,
} from '@shared/engine/battle-v5/core/configs';
import { EventPriorityLevel } from '@shared/engine/battle-v5/core/events';
import {
  AttributeType,
  BuffType,
  DamageSource,
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import {
  DIRECT_DAMAGE_CONDITION,
  SectAbilityFactory,
  sectEffects,
  type SectBuildBuilder,
  type SectProjectionContext,
} from '../../../core';
import { LINGXIAO_BASE_DEFINITION } from '../definition';
import { LINGXIAO_SECT_ID } from '../ids';
import { LINGXIAO_SWORD_MOMENTUM } from '../shared/LingxiaoMechanics';

const abilityDefinition = (abilityId: string) => {
  const definition = LINGXIAO_BASE_DEFINITION.abilities.find(
    (ability) => ability.id === abilityId,
  );
  if (!definition) throw new Error(`凌霄基础神通未定义: ${abilityId}`);
  return definition;
};

const selfBuff = (
  id: string,
  name: string,
  duration: number,
  modifiers: AttributeModifierConfig[],
  listeners?: ListenerConfig[],
): EffectConfig => ({
  type: 'apply_buff',
  params: {
    target: 'caster',
    buffConfig: {
      id,
      name,
      type: BuffType.BUFF,
      duration,
      stackRule: StackRule.REFRESH_DURATION,
      tags: [GameplayTags.BUFF.TYPE.BUFF],
      modifiers,
      listeners,
    },
  },
});

const directReduction = (value: number): ListenerConfig[] => [
  {
    id: `sect.lingxiao.direct-reduction.${value}`,
    eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
    scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
    priority: EventPriorityLevel.DAMAGE_REQUEST + 1,
    mapping: { caster: 'owner', target: 'owner' },
    guard: { skipSecondaryDamageSource: true },
    conditions: [DIRECT_DAMAGE_CONDITION],
    effects: [{ type: 'percent_damage_modifier', params: { mode: 'reduce', value } }],
  },
];

/** 编译无流派时的九个稳定基础神通。 */
export function compileLingxiaoBase(
  context: SectProjectionContext,
  builder: SectBuildBuilder,
): void {
  const factory = new SectAbilityFactory(LINGXIAO_SECT_ID, context.realm);
  const resourceId = LINGXIAO_SWORD_MOMENTUM;
  const active = (
    abilityId: string,
    spec: Omit<Parameters<SectAbilityFactory['active']>[0], 'definition'>,
  ) => builder.setAbility(
    abilityId,
    factory.active({ ...spec, definition: abilityDefinition(abilityId) }),
  );

  active('plain-sword', {
    effects: [sectEffects.physicalDamage(0.8), sectEffects.modifyResource(resourceId, 1)],
    detailRows: ['伤害：1段 × 0.80物攻', '剑势：命中获得1点'],
  });
  active('guiding-sword', {
    effects: [sectEffects.physicalDamage(0.95), sectEffects.modifyResource(resourceId, 2)],
    detailRows: ['伤害：1段 × 0.95物攻', '剑势：命中获得2点'],
  });
  active('linked-edge', {
    effects: [
      sectEffects.physicalDamage(0.55),
      sectEffects.physicalDamage(0.55),
      sectEffects.physicalDamage(0.55),
      sectEffects.modifyResource(resourceId, 1),
    ],
    castEffects: [{ type: 'skip_action', params: { count: 1, reason: '剑落星河·调息' } }],
    detailRows: ['伤害：3段 × 0.55物攻', '剑势：命中获得1点', '调息：施放后下一次行动跳过'],
  });
  active('turning-body', {
    effects: [],
    castEffects: [
      selfBuff('sect.lingxiao.hidden-thunder-guard', '藏锋', 1, [], directReduction(0.25)),
      {
        type: 'queue_action',
        params: {
          id: 'sect.lingxiao.hidden-thunder-strike',
          name: '听雷',
          tags: [
            GameplayTags.ABILITY.FUNCTION.DAMAGE,
            GameplayTags.ABILITY.CHANNEL.PHYSICAL,
            GameplayTags.ABILITY.KIND.SECT,
            GameplayTags.ABILITY.SECT.namespace(LINGXIAO_SECT_ID),
            GameplayTags.ABILITY.SECT.ability(LINGXIAO_SECT_ID, 'turning-body'),
            GameplayTags.ABILITY.SECT.COMBO,
            GameplayTags.ABILITY.TARGET.SINGLE,
          ],
          effects: [
            sectEffects.physicalDamage(2.2),
            sectEffects.modifyResource(resourceId, 2),
          ],
        },
      },
    ],
    detailRows: ['藏锋：直接承伤降低25%', '后发：下一行动造成2.20物攻', '剑势：后发命中获得2点', '受控：蓄力失败且不退还消耗与冷却'],
  });
  active('shadow-step', {
    targetTeam: 'self',
    effects: [
      selfBuff('sect.lingxiao.traceless-step', '踏虚无痕', 2, [
        { attrType: AttributeType.SPEED, type: ModifierType.ADD, value: 0.1 },
        { attrType: AttributeType.EVASION_RATE, type: ModifierType.FIXED, value: 0.08 },
      ]),
    ],
    detailRows: ['身法：提高10%', '闪避：提高8个百分点', '持续：未来2次自身行动'],
  });
  active('breaking-edge', {
    effects: [
      sectEffects.physicalDamage(1.1),
      { type: 'dispel', params: { targetTag: GameplayTags.BUFF.TYPE.BUFF, maxCount: 1 } },
    ],
    detailRows: ['伤害：1.10物攻', '破妄：驱散目标1个正面状态'],
  });
  active('sword-aegis', {
    targetTeam: 'self',
    effects: [
      selfBuff('sect.lingxiao.clear-heart', '明心照剑', 3, [
        { attrType: AttributeType.MAGIC_DEF, type: ModifierType.ADD, value: 0.25 },
        { attrType: AttributeType.CONTROL_RESISTANCE, type: ModifierType.FIXED, value: 0.08 },
      ]),
    ],
    detailRows: ['法术防御：提高25%', '控制抗性：提高8个百分点', '持续：未来3次自身行动'],
  });
  active('nurturing-sword', {
    targetTeam: 'self',
    effects: [
      selfBuff('sect.lingxiao.sword-intent', '剑意冲霄', 3, [
        { attrType: AttributeType.ATK, type: ModifierType.ADD, value: 0.15 },
      ]),
    ],
    detailRows: ['物理攻击：提高15%', '持续：未来3次自身行动', '同名状态：只刷新，不叠层'],
  });
  active('sect-ultimate', {
    castConditions: [{
      type: 'combat_resource_at_least',
      params: { resourceId, value: 3, scope: 'caster' },
    }],
    effects: [{
      type: 'resource_scaled_damage',
      params: {
        resourceId,
        baseCoefficient: 1,
        coefficientPerPoint: 0.35,
        minPoints: 3,
        maxPoints: 6,
        consume: 'all',
        damageSource: DamageSource.DIRECT,
      },
    }],
    detailRows: ['伤害：单段1.00物攻 + 每点剑势0.35物攻', '释放：至少3点剑势', '释放后：消耗全部剑势'],
  });

  builder.setResource({
    id: resourceId,
    name: '剑势',
    initial: 0,
    max: 6,
  });
}
