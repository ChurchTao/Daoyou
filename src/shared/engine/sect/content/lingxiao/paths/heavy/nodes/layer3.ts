import { GameplayTags } from '@shared/engine/shared/tag-domain';
import {
  DAMAGE_MODIFIER_PRIORITY,
  DIRECT_DAMAGE_CONDITION,
  sectEffects,
} from '../../../../../core';
import { createLingxiaoNode } from '../../../shared/createLingxiaoNode';
import {
  HEAVY_UNMOVED_GUARD,
  LINGXIAO_HEAVY_POSTURE,
} from '../../../shared/LingxiaoMechanics';
import {
  addBorrowedNodePassive,
  addLingxiaoPassive,
} from '../../../shared/SwordNodePassives';
import { heavySwordBuild } from '../HeavySwordBuildFacade';

export const HEAVY_LAYER_3_NODES = [
  createLingxiaoNode(
    {
      id: 'heavy-crossing-pass',
      layerId: '3',
      name: '横关',
      description: '横岳式护盾与反击提高50%，反击施加裂甲。',
    },
    (_context, builder) => heavySwordBuild(builder).enable('crossingPass'),
  ),
  createLingxiaoNode(
    {
      id: 'heavy-borrowed-weight',
      layerId: '3',
      name: '借重',
      description: '每回合首次受到直接伤害时获得1点剑架。',
    },
    (context, builder) =>
      addBorrowedNodePassive(context, builder, {
        id: 'heavy-borrowed-weight',
        name: '借重',
        resourceId: LINGXIAO_HEAVY_POSTURE,
      }),
  ),
  createLingxiaoNode(
    {
      id: 'heavy-unmoved',
      layerId: '3',
      name: '不移',
      description: '受控跳过行动时获得1点剑架，并使下一次承伤降低10%。',
    },
    (context, builder) =>
      addLingxiaoPassive(context, builder, {
        id: 'heavy-unmoved',
        name: '不移',
        listeners: [
          {
            id: 'sect.lingxiao.heavy-unmoved.skip',
            eventType: GameplayTags.EVENT.CONTROLLED_SKIP,
            scope: GameplayTags.SCOPE.OWNER_AS_ACTOR,
            priority: 0,
            mapping: { caster: 'owner', target: 'owner' },
            effects: [
              sectEffects.modifyResource(LINGXIAO_HEAVY_POSTURE, 1),
              sectEffects.modifyCounter(HEAVY_UNMOVED_GUARD, 'set', {
                amount: 1,
              }),
            ],
          },
          {
            id: 'sect.lingxiao.heavy-unmoved.guard',
            eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
            scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
            priority: DAMAGE_MODIFIER_PRIORITY,
            mapping: { caster: 'owner', target: 'owner' },
            effects: [
              {
                type: 'percent_damage_modifier',
                params: { mode: 'reduce', value: 0.1 },
                conditions: [
                  sectEffects.counterCondition(HEAVY_UNMOVED_GUARD, 'gte', 1),
                  DIRECT_DAMAGE_CONDITION,
                ],
              },
              sectEffects.modifyCounter(HEAVY_UNMOVED_GUARD, 'reset', {
                conditions: [
                  sectEffects.counterCondition(HEAVY_UNMOVED_GUARD, 'gte', 1),
                  DIRECT_DAMAGE_CONDITION,
                ],
              }),
            ],
          },
        ],
      }),
  ),
] as const;
