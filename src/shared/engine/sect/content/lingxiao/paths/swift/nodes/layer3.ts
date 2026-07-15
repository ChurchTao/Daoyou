import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { sectEffects } from '../../../../../core';
import { createLingxiaoNode } from '../../../shared/createLingxiaoNode';
import {
  LINGXIAO_SWORD_MOMENTUM,
  SWIFT_GUARDED_EDGE,
} from '../../../shared/LingxiaoMechanics';
import {
  addBorrowedNodePassive,
  addLingxiaoPassive,
} from '../../../shared/SwordNodePassives';
import { swiftSwordBuild } from '../SwiftSwordBuildFacade';

export const SWIFT_LAYER_3_NODES = [
  createLingxiaoNode(
    {
      id: 'swift-returning-swallow',
      layerId: '3',
      name: '回燕',
      description: '回燕反击倍率提高50%，反击命中施加1层剑痕。',
    },
    (_context, builder) => swiftSwordBuild(builder).enable('returningSwallow'),
  ),
  createLingxiaoNode(
    {
      id: 'swift-borrowed-force',
      layerId: '3',
      name: '借风',
      description: '每回合首次受到直接伤害时获得1点剑势。',
    },
    (context, builder) =>
      addBorrowedNodePassive(context, builder, {
        id: 'swift-borrowed-force',
        name: '借风',
        resourceId: LINGXIAO_SWORD_MOMENTUM,
      }),
  ),
  createLingxiaoNode(
    {
      id: 'swift-guarded-edge',
      layerId: '3',
      name: '守锋',
      description: '被控制跳过行动时剑势不衰减，控制结束后首次产势额外+1。',
    },
    (context, builder) => {
      swiftSwordBuild(builder).enable('guardedEdge');
      addLingxiaoPassive(context, builder, {
        id: 'swift-guarded-edge',
        name: '守锋',
        listeners: [
          {
            id: 'sect.lingxiao.swift-guarded-edge.skip',
            eventType: GameplayTags.EVENT.CONTROLLED_SKIP,
            scope: GameplayTags.SCOPE.OWNER_AS_ACTOR,
            priority: 0,
            mapping: { caster: 'owner', target: 'owner' },
            effects: [
              sectEffects.modifyCounter(SWIFT_GUARDED_EDGE, 'set', {
                amount: 1,
              }),
            ],
          },
          {
            id: 'sect.lingxiao.swift-guarded-edge.refund',
            eventType: GameplayTags.EVENT.COMBAT_RESOURCE_CHANGE,
            scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
            priority: 0,
            mapping: { caster: 'owner', target: 'owner' },
            effects: [
              sectEffects.modifyCounter(SWIFT_GUARDED_EDGE, 'reset', {
                effects: [
                  sectEffects.modifyResource(LINGXIAO_SWORD_MOMENTUM, 1),
                ],
                conditions: [
                  sectEffects.counterCondition(SWIFT_GUARDED_EDGE, 'gte', 1),
                  sectEffects.resourceChangeCondition(
                    LINGXIAO_SWORD_MOMENTUM,
                    'applied',
                    1,
                  ),
                  {
                    type: 'ability_has_tag',
                    params: { tag: GameplayTags.ABILITY.SECT.GENERATOR },
                  },
                ],
              }),
            ],
          },
        ],
        presentationModifiers: [{
          abilityId: 'guiding-sword',
          factRows: ['经脉·守锋：受控跳过行动时剑势不衰减，下一次产势额外+1'],
        }],
      });
    },
  ),
] as const;
