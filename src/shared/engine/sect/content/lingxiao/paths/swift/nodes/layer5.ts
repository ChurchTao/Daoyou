import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { DAMAGE_MODIFIER_PRIORITY, sectEffects } from '../../../../../core';
import { LINGXIAO_SECT_ID } from '../../../ids';
import { createLingxiaoNode } from '../../../shared/createLingxiaoNode';
import {
  LINGXIAO_SWORD_MOMENTUM,
  SWIFT_FINISHER_ACTION,
  SWIFT_GAPLESS,
  SWIFT_IDLE_ACTIONS,
  SWIFT_LINKED_CITY_ROUND,
} from '../../../shared/LingxiaoMechanics';
import { addLingxiaoPassive } from '../../../shared/SwordNodePassives';
import { swiftSwordBuild } from '../SwiftSwordBuildFacade';

export const SWIFT_LAYER_5_NODES = [
  createLingxiaoNode(
    {
      id: 'swift-gapless',
      layer: 5,
      name: '无隙',
      description: '收束后下一次追风式不耗法力并额外获得1点剑势。',
    },
    (context, builder) => {
      swiftSwordBuild(builder).enable('gapless');
      addLingxiaoPassive(context, builder, {
        id: 'swift-gapless',
        name: '无隙',
        listeners: [
          {
            id: 'sect.lingxiao.swift-gapless.bonus',
            eventType: GameplayTags.EVENT.COMBAT_RESOURCE_CHANGE,
            scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
            priority: 0,
            mapping: { caster: 'owner', target: 'owner' },
            effects: [
              sectEffects.modifyCounter(SWIFT_GAPLESS, 'reset', {
                effects: [
                  sectEffects.modifyResource(LINGXIAO_SWORD_MOMENTUM, 1),
                ],
                conditions: [
                  sectEffects.counterCondition(SWIFT_GAPLESS, 'gte', 1),
                  sectEffects.resourceChangeCondition(
                    LINGXIAO_SWORD_MOMENTUM,
                    'applied',
                    1,
                  ),
                  {
                    type: 'ability_has_tag',
                    params: {
                      tag: GameplayTags.ABILITY.SECT.ability(
                        LINGXIAO_SECT_ID,
                        'guiding-sword',
                      ),
                    },
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
      id: 'swift-linked-city',
      layer: 5,
      name: '连城',
      description:
        '多段技能完整命中时，其他快剑技能冷却减少1回合，每回合一次。',
    },
    (context, builder) => {
      swiftSwordBuild(builder).enable('linkedCity');
      addLingxiaoPassive(context, builder, {
        id: 'swift-linked-city-round',
        name: '连城',
        listeners: [
          {
            id: 'sect.lingxiao.swift-linked-city-round.reset',
            eventType: GameplayTags.EVENT.ROUND_START,
            scope: GameplayTags.SCOPE.GLOBAL,
            priority: 0,
            mapping: { caster: 'owner', target: 'owner' },
            effects: [
              sectEffects.modifyCounter(SWIFT_LINKED_CITY_ROUND, 'reset'),
            ],
          },
        ],
      });
    },
  ),
  createLingxiaoNode(
    {
      id: 'swift-still-tide',
      layer: 5,
      name: '静潮',
      description: '连续两个自身行动未收束后暂停剑势衰减，下一次收束提高20%。',
    },
    (context, builder) => {
      swiftSwordBuild(builder).enable('stillTide');
      addLingxiaoPassive(context, builder, {
        id: 'swift-still-tide',
        name: '静潮',
        listeners: [
          {
            id: 'sect.lingxiao.swift-still-tide.action',
            eventType: GameplayTags.EVENT.ACTION_POST,
            scope: GameplayTags.SCOPE.OWNER_AS_ACTOR,
            priority: 0,
            mapping: { caster: 'owner', target: 'owner' },
            effects: [
              sectEffects.modifyCounter(SWIFT_IDLE_ACTIONS, 'add', {
                max: 2,
                conditions: [
                  sectEffects.counterCondition(SWIFT_FINISHER_ACTION, 'lt', 1),
                ],
              }),
              sectEffects.modifyCounter(SWIFT_IDLE_ACTIONS, 'reset', {
                conditions: [
                  sectEffects.counterCondition(SWIFT_FINISHER_ACTION, 'gte', 1),
                ],
              }),
              sectEffects.modifyCounter(SWIFT_FINISHER_ACTION, 'reset'),
            ],
          },
          {
            id: 'sect.lingxiao.swift-still-tide.damage',
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
                  sectEffects.counterCondition(SWIFT_IDLE_ACTIONS, 'gte', 2),
                ],
              },
            ],
          },
        ],
      });
    },
  ),
] as const;
