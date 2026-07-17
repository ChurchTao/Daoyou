import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import type { EffectConfig } from '@shared/engine/battle-v5/core/configs';
import { EventPriorityLevel } from '@shared/engine/battle-v5/core/events';
import {
  AttributeType,
  BuffType,
  DamageSource,
  DamageType,
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { withSectBuffMethodGrowth } from '../../../core';
import { LINGXIAO_BASE_DEFINITION } from '../definition';
import { LINGXIAO_SECT_ID } from '../ids';

export const LINGXIAO_SWORD_MOMENTUM =
  LINGXIAO_BASE_DEFINITION.combatResource.id;
export const LINGXIAO_SWORD_MARK_BUFF = 'sect.lingxiao.sword-mark';
export const LINGXIAO_ARMOR_REND_BUFF = 'sect.lingxiao.armor-rend';
export const LINGXIAO_RETURNING_SWALLOW_BUFF =
  'sect.lingxiao.returning-swallow';

export const SWIFT_GUARDED_EDGE = 'sect.lingxiao.swift.guarded-edge';
export const SWIFT_IDLE_ACTIONS = 'sect.lingxiao.swift.idle-actions';
export const SWIFT_FINISHER_ACTION = 'sect.lingxiao.swift.finisher-action';
export const SWIFT_LINKED_CITY_ROUND = 'sect.lingxiao.swift.linked-city-round';
export const SWIFT_ENDLESS_COOLDOWN = 'sect.lingxiao.swift.endless-cooldown';
export const SWIFT_GAPLESS = 'sect.lingxiao.swift.gapless';

export const HEAVY_ECHO_COOLDOWN = 'sect.lingxiao.heavy.echo-cooldown';

export function createSwordMark(): EffectConfig {
  return {
    type: 'apply_buff',
    params: {
      target: 'target',
      buffConfig: withSectBuffMethodGrowth(
        {
          id: LINGXIAO_SWORD_MARK_BUFF,
          name: '剑痕',
          description:
            '每层使受到的直接、反击和追击伤害提高，可被《剑破万法》引动。',
          type: BuffType.DEBUFF,
          duration: 3,
          stackRule: StackRule.STACK_LAYER,
          maxLayers: 3,
          tags: [
            GameplayTags.BUFF.TYPE.DEBUFF,
            GameplayTags.BUFF.SECT.namespace(LINGXIAO_SECT_ID, 'SwordMark'),
          ],
          statusTags: [
            GameplayTags.STATUS.SECT.state(LINGXIAO_SECT_ID, 'SwordMarked'),
          ],
          listeners: [
            {
              id: 'sect.lingxiao.sword-mark.damage-taken',
              eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
              scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
              priority: EventPriorityLevel.DAMAGE_REQUEST + 1,
              mapping: { caster: 'owner', target: 'owner' },
              effects: [
                {
                  type: 'percent_damage_modifier',
                  params: {
                    mode: 'increase',
                    value: 0.02,
                    scaleByBuffLayer: true,
                    allowedDamageSources: [
                      DamageSource.DIRECT,
                      DamageSource.COUNTER,
                      DamageSource.FOLLOW_UP,
                    ],
                    excludedDamageTypes: [DamageType.DOT],
                  },
                },
              ],
            },
          ],
        },
        { methodId: 'lingxiao-canon', duration: true },
      ),
    },
  };
}

export function createArmorRend(layers = 1): EffectConfig[] {
  return Array.from({ length: layers }, () => ({
    type: 'apply_buff' as const,
    params: {
      target: 'target' as const,
      buffConfig: withSectBuffMethodGrowth(
        {
          id: LINGXIAO_ARMOR_REND_BUFF,
          name: '裂甲',
          description: '每层降低目标物理防御。',
          type: BuffType.DEBUFF,
          duration: 3,
          stackRule: StackRule.STACK_LAYER,
          maxLayers: 3,
          tags: [GameplayTags.BUFF.TYPE.DEBUFF],
          modifiers: [
            {
              attrType: AttributeType.DEF,
              type: ModifierType.ADD,
              value: -0.03,
              scaleByLayer: true,
            },
          ],
        },
        { methodId: 'lingxiao-canon', duration: true },
      ),
    },
  }));
}
