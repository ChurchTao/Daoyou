import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { sectEffects } from '../../../../../core';
import { createLingxiaoNode } from '../../../shared/createLingxiaoNode';
import {
  LINGXIAO_SWORD_MOMENTUM,
  SWIFT_RETAINED_FORCE,
} from '../../../shared/LingxiaoMechanics';
import { addLingxiaoPassive } from '../../../shared/SwordNodePassives';
import { swiftSwordBuild } from '../SwiftSwordBuildFacade';

export const SWIFT_LAYER_2_NODES = [
  createLingxiaoNode(
    {
      id: 'swift-split-light',
      layerId: '2',
      name: '分光',
      description: '流光三叠改为五段，总倍率1.35并获得3点剑势。',
    },
    (_context, builder) => swiftSwordBuild(builder).enable('splitLight'),
  ),
  createLingxiaoNode(
    {
      id: 'swift-stacking-waves',
      layerId: '2',
      name: '叠浪',
      description: '流光三叠完整命中后，追风式冷却减少1回合。',
    },
    (_context, builder) => swiftSwordBuild(builder).enable('stackingWaves'),
  ),
  createLingxiaoNode(
    {
      id: 'swift-retained-force',
      layerId: '2',
      name: '留势',
      description: '溢出剑势最多记录2点，下一次收束后返还。',
    },
    (context, builder) => {
      swiftSwordBuild(builder).enable('retainedForce');
      addLingxiaoPassive(context, builder, {
        id: 'swift-retained-force',
        name: '留势',
        listeners: [
          {
            id: 'sect.lingxiao.swift-retained-force.overflow',
            eventType: GameplayTags.EVENT.COMBAT_RESOURCE_CHANGE,
            scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
            priority: 0,
            mapping: { caster: 'owner', target: 'owner' },
            effects: [
              sectEffects.modifyCounter(SWIFT_RETAINED_FORCE, 'add', {
                amountFromEvent: 'overflow',
                max: 2,
                conditions: [
                  sectEffects.resourceChangeCondition(
                    LINGXIAO_SWORD_MOMENTUM,
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
