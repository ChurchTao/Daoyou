import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import {
  AttributeType,
  BuffType,
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import {
  SectAbilityFactory,
  sectEffects,
  type SectBuildBuilder,
  type SectProjectionContext,
} from '../../../core';
import { LINGXIAO_BASE_DEFINITION } from '../definition';
import { LINGXIAO_SECT_ID } from '../ids';
import {
  createSwordMark,
  LINGXIAO_SHADOW_STEP_BUFF,
  LINGXIAO_SWORD_MOMENTUM,
} from '../shared/LingxiaoMechanics';

const abilityDefinition = (abilityId: string) => {
  const definition = LINGXIAO_BASE_DEFINITION.abilities.find(
    (ability) => ability.id === abilityId,
  );
  if (!definition) throw new Error(`凌霄基础神通未定义: ${abilityId}`);
  return definition;
};

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
  ) =>
    builder.setAbility(
      abilityId,
      factory.active({ ...spec, definition: abilityDefinition(abilityId) }),
    );

  active('plain-sword', {
    effects: [
      sectEffects.physicalDamage(0.8),
      sectEffects.modifyResource(resourceId, 1),
    ],
    detailRows: ['伤害：1段 × 0.80物攻', '剑势：获得1点'],
  });
  active('guiding-sword', {
    effects: [
      sectEffects.physicalDamage(0.85),
      sectEffects.modifyResource(resourceId, 1),
    ],
    detailRows: ['伤害：0.85物攻', '剑势：获得1点'],
  });
  active('linked-edge', {
    effects: [
      sectEffects.physicalDamage(0.42),
      sectEffects.physicalDamage(0.42),
      sectEffects.physicalDamage(0.42),
      sectEffects.modifyResource(resourceId, 2),
      createSwordMark(),
    ],
    detailRows: ['伤害：3段 × 0.42物攻', '剑势：获得2点', '剑痕：施加1层'],
  });
  active('turning-body', {
    effects: [sectEffects.physicalDamage(0.65)],
    detailRows: ['伤害：0.65物攻'],
  });
  active('breaking-edge', {
    castConditions: [
      {
        type: 'combat_resource_at_least',
        params: { resourceId, value: 3, scope: 'caster' },
      },
    ],
    effects: [
      sectEffects.physicalDamage(1),
      sectEffects.consumeResource(resourceId),
    ],
    detailRows: ['伤害：1.00物攻', '释放：至少3点剑势', '释放后：消耗全部剑势'],
  });
  active('sword-aegis', {
    targetTeam: 'self',
    effects: [sectEffects.shieldByAttack(0.6)],
    detailRows: ['护盾：0.60物攻'],
  });
  active('shadow-step', {
    effects: [
      sectEffects.physicalDamage(0.55),
      {
        type: 'apply_buff',
        params: {
          target: 'caster',
          buffConfig: {
            id: LINGXIAO_SHADOW_STEP_BUFF,
            name: '踏影',
            type: BuffType.BUFF,
            duration: 2,
            stackRule: StackRule.REFRESH_DURATION,
            tags: [GameplayTags.BUFF.TYPE.BUFF],
            modifiers: [
              {
                attrType: AttributeType.SPEED,
                type: ModifierType.ADD,
                value: 0.1,
              },
            ],
          },
        },
      },
    ],
    detailRows: ['伤害：0.55物攻', '身法：提高10%，持续2回合'],
  });
  active('sect-ultimate', {
    effects: [sectEffects.physicalDamage(1.8)],
    detailRows: ['伤害：1.80物攻'],
  });
  active('nurturing-sword', {
    targetTeam: 'self',
    heal: true,
    effects: [sectEffects.healMaxHp(0.08), sectEffects.shieldByAttack(0.35)],
    detailRows: ['恢复：8%最大气血', '护盾：0.35物攻'],
  });
  builder.setResource({
    id: resourceId,
    name: '剑势',
    initial: 0,
    max: 3,
    decayOnNoDirectDamage: 1,
    decayOnControlledSkip: 1,
    pauseDecayWhileShielded: true,
  });
}
