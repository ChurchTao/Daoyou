import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import type { EffectConfig } from '@shared/engine/battle-v5/core/configs';
import { BuffType } from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { LINGXIAO_SECT_ID } from '../ids';
import { LINGXIAO_BASE_DEFINITION } from '../definition';

export const LINGXIAO_SWORD_MOMENTUM =
  LINGXIAO_BASE_DEFINITION.combatResource.id;
export const LINGXIAO_SWORD_MARK_BUFF = 'sect.lingxiao.sword-mark';
export const LINGXIAO_ARMOR_REND_BUFF = 'sect.lingxiao.armor-rend';
export const LINGXIAO_RETURNING_SWALLOW_BUFF =
  'sect.lingxiao.returning-swallow';
export const LINGXIAO_SHADOW_STEP_BUFF = 'sect.lingxiao.shadow-step';

export const SWIFT_RETAINED_FORCE = 'sect.lingxiao.swift.retained-force';
export const SWIFT_GUARDED_EDGE = 'sect.lingxiao.swift.guarded-edge';
export const SWIFT_IDLE_ACTIONS = 'sect.lingxiao.swift.idle-actions';
export const SWIFT_FINISHER_ACTION = 'sect.lingxiao.swift.finisher-action';
export const SWIFT_LINKED_CITY_ROUND = 'sect.lingxiao.swift.linked-city-round';
export const SWIFT_ENDLESS_COOLDOWN = 'sect.lingxiao.swift.endless-cooldown';
export const SWIFT_GAPLESS = 'sect.lingxiao.swift.gapless';

export const HEAVY_UNMOVED_GUARD = 'sect.lingxiao.heavy.unmoved-guard';
export const HEAVY_IDLE_ACTIONS = 'sect.lingxiao.heavy.idle-actions';
export const HEAVY_FINISHER_ACTION = 'sect.lingxiao.heavy.finisher-action';
export const HEAVY_AFTERSHOCK_ROUND = 'sect.lingxiao.heavy.aftershock-round';
export const HEAVY_LINKED_MOUNTAINS = 'sect.lingxiao.heavy.linked-mountains';
export const HEAVY_ECHO_COOLDOWN = 'sect.lingxiao.heavy.echo-cooldown';

export function createSwordMark(): EffectConfig {
  return {
    type: 'apply_buff',
    params: {
      target: 'target',
      buffConfig: {
        id: LINGXIAO_SWORD_MARK_BUFF,
        name: '剑痕',
        description: '快剑留下的剑痕，可被收束招式利用。',
        type: BuffType.DEBUFF,
        duration: 2,
        stackRule: StackRule.STACK_LAYER,
        maxLayers: 3,
        tags: [
          GameplayTags.BUFF.TYPE.DEBUFF,
          GameplayTags.BUFF.SECT.namespace(LINGXIAO_SECT_ID, 'SwordMark'),
        ],
        statusTags: [
          GameplayTags.STATUS.SECT.state(LINGXIAO_SECT_ID, 'SwordMarked'),
        ],
      },
    },
  };
}

export function createArmorRend(): EffectConfig {
  return {
    type: 'apply_buff',
    params: {
      target: 'target',
      buffConfig: {
        id: LINGXIAO_ARMOR_REND_BUFF,
        name: '裂甲',
        description: '重剑震裂护体气机。',
        type: BuffType.DEBUFF,
        duration: 2,
        stackRule: StackRule.STACK_LAYER,
        maxLayers: 3,
        tags: [
          GameplayTags.BUFF.TYPE.DEBUFF,
          GameplayTags.BUFF.SECT.namespace(LINGXIAO_SECT_ID, 'ArmorRend'),
        ],
      },
    },
  };
}
