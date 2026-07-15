import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { sectEffects } from '../../../../../core';
import { createLingxiaoNode } from '../../../shared/createLingxiaoNode';
import { SWIFT_ENDLESS_COOLDOWN } from '../../../shared/LingxiaoMechanics';
import { addLingxiaoPassive } from '../../../shared/SwordNodePassives';
import { swiftSwordBuild } from '../SwiftSwordBuildFacade';

export const SWIFT_ULTIMATE_NODES = [
  createLingxiaoNode(
    {
      id: 'swift-endless-flow',
      layerId: 'ultimate',
      name: '无间',
      description: '收束后追加0.6物攻追击并获得1点剑势，每3回合一次。',
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
        presentationModifiers: [{
          abilityId: 'sect-ultimate',
          factRows: ['经脉·无间：收束后追加0.60物攻追击并获得1点剑势，每3回合一次'],
        }],
      });
    },
  ),
  createLingxiaoNode(
    {
      id: 'swift-shadow-line',
      layerId: 'ultimate',
      name: '绝影',
      description: '6势收束全部段必定暴击，冷却增加1回合。',
    },
    (_context, builder) => swiftSwordBuild(builder).enable('shadowLine'),
  ),
  createLingxiaoNode(
    {
      id: 'swift-unending-wind',
      layerId: 'ultimate',
      name: '回风',
      description: '每次回燕姿态首次闪避获得0.40物攻护盾并留1层剑痕。',
    },
    (_context, builder) => swiftSwordBuild(builder).enable('unendingWind'),
  ),
] as const;
