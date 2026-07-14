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
      layer: 'ultimate',
      name: '无间剑流',
      description: '收束后追加0.6物攻追击并获得1点剑势，每3回合一次。',
    },
    (context, builder) => {
      swiftSwordBuild(builder).enable('endlessFlow');
      addLingxiaoPassive(context, builder, {
        id: 'swift-endless-flow-round',
        name: '无间剑流',
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
      });
    },
  ),
  createLingxiaoNode(
    {
      id: 'swift-shadow-line',
      layer: 'ultimate',
      name: '绝影一线',
      description: '一线天改为满6剑势强击，强制暴击且冷却增加1回合。',
    },
    (_context, builder) => swiftSwordBuild(builder).enable('shadowLine'),
  ),
  createLingxiaoNode(
    {
      id: 'swift-unending-wind',
      layer: 'ultimate',
      name: '回风不息',
      description: '回燕反击施加剑痕并获得护盾，每次姿态最多一次。',
    },
    (_context, builder) => swiftSwordBuild(builder).enable('unendingWind'),
  ),
] as const;
