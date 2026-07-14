import { GameplayTags } from '@shared/engine/shared/tag-domain';
import {
  DAMAGE_MODIFIER_PRIORITY,
  DIRECT_DAMAGE_CONDITION,
  sectEffects,
} from '../../../../../core';
import { createLingxiaoNode } from '../../../shared/createLingxiaoNode';
import {
  HEAVY_AFTERSHOCK_ROUND,
  HEAVY_FINISHER_ACTION,
  HEAVY_IDLE_ACTIONS,
  HEAVY_LINKED_MOUNTAINS,
  LINGXIAO_HEAVY_POSTURE,
} from '../../../shared/LingxiaoMechanics';
import { addLingxiaoPassive } from '../../../shared/SwordNodePassives';
import { heavySwordBuild } from '../HeavySwordBuildFacade';

export const HEAVY_LAYER_5_NODES = [
  createLingxiaoNode(
    {
      id: 'heavy-aftershock',
      layer: 5,
      name: '余震',
      description: '收束后延迟追加0.6物攻伤害，每回合最多一次。',
    },
    (context, builder) => {
      heavySwordBuild(builder).enable('aftershock');
      addLingxiaoPassive(context, builder, {
        id: 'heavy-aftershock-round',
        name: '余震',
        listeners: [
          {
            id: 'sect.lingxiao.heavy-aftershock-round.reset',
            eventType: GameplayTags.EVENT.ROUND_START,
            scope: GameplayTags.SCOPE.GLOBAL,
            priority: 0,
            mapping: { caster: 'owner', target: 'owner' },
            effects: [
              sectEffects.modifyCounter(HEAVY_AFTERSHOCK_ROUND, 'reset'),
            ],
          },
        ],
      });
    },
  ),
  createLingxiaoNode(
    {
      id: 'heavy-linked-mountains',
      layer: 5,
      name: '连山',
      description: '收束后下一次产架技能不耗法力并额外获得1点剑架。',
    },
    (context, builder) => {
      heavySwordBuild(builder).enable('linkedMountains');
      addLingxiaoPassive(context, builder, {
        id: 'heavy-linked-mountains',
        name: '连山',
        listeners: [
          {
            id: 'sect.lingxiao.heavy-linked-mountains.bonus',
            eventType: GameplayTags.EVENT.COMBAT_RESOURCE_CHANGE,
            scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
            priority: 0,
            mapping: { caster: 'owner', target: 'owner' },
            effects: [
              sectEffects.modifyCounter(HEAVY_LINKED_MOUNTAINS, 'reset', {
                effects: [
                  sectEffects.modifyResource(LINGXIAO_HEAVY_POSTURE, 1),
                ],
                conditions: [
                  sectEffects.counterCondition(
                    HEAVY_LINKED_MOUNTAINS,
                    'gte',
                    1,
                  ),
                  sectEffects.resourceChangeCondition(
                    LINGXIAO_HEAVY_POSTURE,
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
      });
    },
  ),
  createLingxiaoNode(
    {
      id: 'heavy-steady-mountain',
      layer: 5,
      name: '镇岳',
      description: '满剑架时承伤降低10%；连续两个行动未收束时强化下一次收束。',
    },
    (context, builder) =>
      addLingxiaoPassive(context, builder, {
        id: 'heavy-steady-mountain',
        name: '镇岳',
        listeners: [
          {
            id: 'sect.lingxiao.heavy-steady-mountain.action',
            eventType: GameplayTags.EVENT.ACTION_POST,
            scope: GameplayTags.SCOPE.OWNER_AS_ACTOR,
            priority: 0,
            mapping: { caster: 'owner', target: 'owner' },
            effects: [
              sectEffects.modifyCounter(HEAVY_IDLE_ACTIONS, 'add', {
                max: 2,
                conditions: [
                  sectEffects.counterCondition(HEAVY_FINISHER_ACTION, 'lt', 1),
                ],
              }),
              sectEffects.modifyCounter(HEAVY_IDLE_ACTIONS, 'reset', {
                conditions: [
                  sectEffects.counterCondition(HEAVY_FINISHER_ACTION, 'gte', 1),
                ],
              }),
              sectEffects.modifyCounter(HEAVY_FINISHER_ACTION, 'reset'),
            ],
          },
          {
            id: 'sect.lingxiao.heavy-steady-mountain.guard',
            eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
            scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
            priority: DAMAGE_MODIFIER_PRIORITY,
            mapping: { caster: 'owner', target: 'owner' },
            conditions: [DIRECT_DAMAGE_CONDITION],
            effects: [
              {
                type: 'percent_damage_modifier',
                params: { mode: 'reduce', value: 0.1 },
                conditions: [
                  {
                    type: 'combat_resource_at_least',
                    params: {
                      resourceId: LINGXIAO_HEAVY_POSTURE,
                      value: 6,
                      scope: 'caster',
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'sect.lingxiao.heavy-steady-mountain.finisher',
            eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
            scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
            priority: DAMAGE_MODIFIER_PRIORITY,
            mapping: { caster: 'owner', target: 'event.target' },
            effects: [
              {
                type: 'percent_damage_modifier',
                params: { mode: 'increase', value: 0.2 },
                conditions: [
                  {
                    type: 'ability_has_tag',
                    params: { tag: GameplayTags.ABILITY.SECT.FINISHER },
                  },
                  sectEffects.counterCondition(HEAVY_IDLE_ACTIONS, 'gte', 2),
                ],
              },
            ],
          },
        ],
      }),
  ),
] as const;
