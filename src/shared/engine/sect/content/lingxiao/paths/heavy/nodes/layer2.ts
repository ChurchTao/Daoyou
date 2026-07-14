import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { sectEffects } from '../../../../../core';
import { createLingxiaoNode } from '../../../shared/createLingxiaoNode';
import {
  HEAVY_RETAINED_FRAME_ACTION,
  LINGXIAO_HEAVY_POSTURE,
} from '../../../shared/LingxiaoMechanics';
import { addLingxiaoPassive } from '../../../shared/SwordNodePassives';
import { heavySwordBuild } from '../HeavySwordBuildFacade';

export const HEAVY_LAYER_2_NODES = [
  createLingxiaoNode(
    {
      id: 'heavy-triple-ridge',
      layer: 2,
      name: '三叠岳',
      description: '叠山式改为三段，总倍率1.5并获得3点剑架。',
    },
    (_context, builder) => heavySwordBuild(builder).enable('tripleRidge'),
  ),
  createLingxiaoNode(
    {
      id: 'heavy-shattering-armor',
      layer: 2,
      name: '碎甲',
      description: '叠山式改为施加2层裂甲。',
    },
    (_context, builder) => heavySwordBuild(builder).enable('shatteringArmor'),
  ),
  createLingxiaoNode(
    {
      id: 'heavy-retained-frame',
      layer: 2,
      name: '留架',
      description: '每次行动最多将2点溢出剑架转为护盾。',
    },
    (context, builder) => {
      addLingxiaoPassive(context, builder, {
        id: 'heavy-retained-frame',
        name: '留架',
        listeners: [
          {
            id: 'sect.lingxiao.heavy-retained-frame.reset',
            eventType: GameplayTags.EVENT.ACTION_PRE,
            scope: GameplayTags.SCOPE.GLOBAL,
            priority: 1,
            mapping: { caster: 'owner', target: 'owner' },
            effects: [
              sectEffects.modifyCounter(HEAVY_RETAINED_FRAME_ACTION, 'reset'),
            ],
          },
          {
            id: 'sect.lingxiao.heavy-retained-frame.overflow',
            eventType: GameplayTags.EVENT.COMBAT_RESOURCE_CHANGE,
            scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
            priority: 0,
            mapping: { caster: 'owner', target: 'owner' },
            effects: [
              sectEffects.modifyCounter(HEAVY_RETAINED_FRAME_ACTION, 'add', {
                amountFromEvent: 'overflow',
                max: 2,
                scaleEffectsByAmount: true,
                effects: [
                  sectEffects.shieldByAttack(
                    0.15 * (1 + context.path.level * 0.0008),
                  ),
                ],
                conditions: [
                  sectEffects.resourceChangeCondition(
                    LINGXIAO_HEAVY_POSTURE,
                    'overflow',
                    1,
                  ),
                ],
              }),
            ],
          },
        ],
      });
    },
  ),
] as const;
