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
  withSectBuffMethodGrowth,
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
  growsWithMethod = true,
): EffectConfig => ({
  type: 'apply_buff',
  params: {
    target: 'caster',
    buffConfig: withSectBuffMethodGrowth(
      {
        id,
        name,
        type: BuffType.BUFF,
        duration,
        stackRule: StackRule.REFRESH_DURATION,
        tags: [GameplayTags.BUFF.TYPE.BUFF],
        modifiers,
        listeners,
      },
      { duration: growsWithMethod },
    ),
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
    effects: [
      { type: 'percent_damage_modifier', params: { mode: 'reduce', value } },
    ],
  },
];

/** 编译无流派时的九个稳定基础神通。 */
export function compileLingxiaoBase(
  context: SectProjectionContext,
  builder: SectBuildBuilder,
): void {
  const factory = new SectAbilityFactory(LINGXIAO_SECT_ID);
  const resourceId = LINGXIAO_SWORD_MOMENTUM;
  const active = (
    abilityId: string,
    spec: Omit<Parameters<SectAbilityFactory['active']>[0], 'definition'>,
  ) =>
    builder.setAbility(
      abilityId,
      factory.active({ ...spec, definition: abilityDefinition(abilityId) }),
    );

  active('plain-sword', {
    effects: [
      sectEffects.physicalDamage(0.7),
      sectEffects.modifyResource(resourceId, 1),
    ],
  });
  active('guiding-sword', {
    effects: [
      sectEffects.physicalDamage(0.82),
      sectEffects.modifyResource(resourceId, 2),
    ],
  });
  active('linked-edge', {
    effects: [
      sectEffects.physicalDamage(0.47),
      sectEffects.physicalDamage(0.47),
      sectEffects.physicalDamage(0.47),
      sectEffects.modifyResource(resourceId, 1),
    ],
    castEffects: [
      {
        type: 'skip_action',
        params: { count: 1, name: '调息', reason: '剑荡山河·调息' },
      },
    ],
  });
  active('turning-body', {
    effects: [],
    castEffects: [
      selfBuff(
        'sect.lingxiao.hidden-thunder-guard',
        '藏锋听雷',
        1,
        [],
        directReduction(0.2),
        false,
      ),
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
            sectEffects.physicalDamage(1.8),
            sectEffects.modifyResource(resourceId, 2),
          ],
          interruptPolicy: 'uninterruptible',
          hitPolicy: 'guaranteed',
        },
      },
    ],
  });
  active('shadow-step', {
    targetTeam: 'self',
    effects: [
      selfBuff('sect.lingxiao.traceless-step', '踏雪无痕', 2, [
        { attrType: AttributeType.SPEED, type: ModifierType.ADD, value: 0.08 },
        {
          attrType: AttributeType.EVASION_RATE,
          type: ModifierType.FIXED,
          value: 0.06,
        },
      ]),
    ],
  });
  active('breaking-edge', {
    effects: [
      sectEffects.physicalDamage(0.95),
      {
        type: 'dispel',
        params: { targetTag: GameplayTags.BUFF.TYPE.BUFF, maxCount: 1 },
      },
    ],
  });
  active('sword-aegis', {
    targetTeam: 'self',
    effects: [
      selfBuff('sect.lingxiao.clear-heart', '剑心通明', 3, [
        {
          attrType: AttributeType.MAGIC_DEF,
          type: ModifierType.ADD,
          value: 0.2,
        },
        {
          attrType: AttributeType.CONTROL_RESISTANCE,
          type: ModifierType.FIXED,
          value: 0.06,
        },
      ]),
    ],
  });
  active('nurturing-sword', {
    targetTeam: 'self',
    effects: [
      selfBuff('sect.lingxiao.sword-intent', '人剑合一', 3, [
        { attrType: AttributeType.ATK, type: ModifierType.ADD, value: 0.12 },
      ]),
    ],
  });
  active('sect-ultimate', {
    castConditions: [
      {
        type: 'combat_resource_at_least',
        params: { resourceId, value: 3, scope: 'caster' },
      },
    ],
    effects: [
      {
        type: 'resource_scaled_damage',
        params: {
          resourceId,
          baseCoefficient: 0.85,
          coefficientPerPoint: 0.28,
          minPoints: 3,
          maxPoints: 6,
          consume: 'all',
          damageSource: DamageSource.DIRECT,
        },
      },
    ],
  });

  builder.setResource({
    ...LINGXIAO_BASE_DEFINITION.combatResource,
    initial: 0,
  });
}
