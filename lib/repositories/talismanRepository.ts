import { EffectTrigger, EffectType } from '@/engine/effect/types';
import type { Consumable } from '@/types/cultivator';

/**
 * 特殊符箓配置,Map
 */
export const SPECIAL_TALISMAN_CONFIG: Record<string, Consumable> = {
  天机逆命符: {
    name: '天机逆命符',
    type: '符箓',
    quality: '仙品',
    quantity: 1,
    description:
      '以此符遮蔽天机，逆转先天之数。可获三次推演命格之机，择优而栖。',
    effects: [
      {
        type: EffectType.ConsumeAddBuff,
        trigger: EffectTrigger.ON_CONSUME,
        params: {
          buffId: 'reshape_fate_talisman',
          expiryMinutes: 3600,
          maxUses: 3,
        },
      },
    ],
  },
  悟道演法符: {
    name: '悟道演法符',
    type: '符箓',
    quality: '仙品',
    quantity: 1,
    description:
      '燃此符可神游太虚，感悟天地至理。三日内可得一次机缘，从虚空中领悟一部玄品以上功法典籍。',
    effects: [
      {
        type: EffectType.ConsumeAddBuff,
        trigger: EffectTrigger.ON_CONSUME,
        params: {
          buffId: 'draw_gongfa_talisman',
          expiryMinutes: 3600,
          maxUses: 1,
          drawType: 'gongfa' as const,
        },
      },
    ],
  },
  神通衍化符: {
    name: '神通衍化符',
    type: '符箓',
    quality: '仙品',
    quantity: 1,
    description:
      '此符蕴含天地法则碎片。三日内可得一次机缘，衍化出一门玄品以上神通秘术。',
    effects: [
      {
        type: EffectType.ConsumeAddBuff,
        trigger: EffectTrigger.ON_CONSUME,
        params: {
          buffId: 'draw_skill_talisman',
          expiryMinutes: 3600,
          maxUses: 1,
          drawType: 'skill' as const,
        },
      },
    ],
  },
};
