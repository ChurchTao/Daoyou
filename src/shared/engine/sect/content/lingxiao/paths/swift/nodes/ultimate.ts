import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { sectEffects } from '../../../../../core';
import { createLingxiaoNode } from '../../../shared/createLingxiaoNode';
import { SWIFT_ENDLESS_COOLDOWN } from '../../../shared/LingxiaoMechanics';
import {
  growthMagnitude,
  nodePercent,
} from '../../../shared/LingxiaoNodeDescription';
import { addLingxiaoPassive } from '../../../shared/SwordNodePassives';
import { swiftSwordBuild } from '../SwiftSwordBuildFacade';
import {
  SWIFT_ENDLESS_FLOW_COEFFICIENT,
  SWIFT_UNENDING_WIND_SHIELD_COEFFICIENT,
} from '../variants';

export const SWIFT_ULTIMATE_NODES = [
  createLingxiaoNode(
    {
      id: 'swift-endless-flow',
      layerId: 'ultimate',
      name: '无间',
      description:
        '施展《剑破万法》后，追加随《问剑篇》成长的追击并获得1点剑势，每3回合最多触发一次。',
    },
    (context, builder) => {
      swiftSwordBuild(builder).enable('endlessFlow');
      addLingxiaoPassive(context, builder, {
        id: 'swift-endless-flow-round',
        name: '无间',
        listeners: [
          {
            id: 'sect.lingxiao.swift-endless-flow-round.tick',
            eventType: GameplayTags.EVENT.ROUND_START,
            scope: GameplayTags.SCOPE.GLOBAL,
            priority: 0,
            mapping: { caster: 'owner', target: 'owner' },
            effects: [
              sectEffects.modifyCounter(SWIFT_ENDLESS_COOLDOWN, 'subtract', {
                amount: 1,
              }),
            ],
          },
        ],
        presentationModifiers: [
          {
            abilityId: 'sect-ultimate',
            factRows: ['参悟·无间：每3回合最多触发一次'],
          },
        ],
      });
    },
    (context) =>
      `施展《剑破万法》后，追加相当于${nodePercent(growthMagnitude(context, 'lingxiao-canon', SWIFT_ENDLESS_FLOW_COEFFICIENT))}物攻的追击并获得1点剑势，每3回合最多触发一次。`,
  ),
  createLingxiaoNode(
    {
      id: 'swift-shadow-line',
      layerId: 'ultimate',
      name: '绝影',
      description:
        '以6点剑势施展《剑破万法》时，总伤害降低15%，全部伤害段必定暴击，冷却增加1回合。',
    },
    (_context, builder) => swiftSwordBuild(builder).enable('shadowLine'),
  ),
  createLingxiaoNode(
    {
      id: 'swift-unending-wind',
      layerId: 'ultimate',
      name: '回风',
      description:
        '每次《藏锋听雷》持续期间首次闪避时，获得随《凌虚步》成长的护盾，并施加1层剑痕。',
    },
    (_context, builder) => swiftSwordBuild(builder).enable('unendingWind'),
    (context) =>
      `每次《藏锋听雷》持续期间首次闪避时，获得相当于${nodePercent(growthMagnitude(context, 'void-step', SWIFT_UNENDING_WIND_SHIELD_COEFFICIENT))}物攻的护盾，并施加1层剑痕。`,
  ),
] as const;
