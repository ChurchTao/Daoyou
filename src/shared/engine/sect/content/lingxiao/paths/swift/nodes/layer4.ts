import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { DAMAGE_MODIFIER_PRIORITY } from '../../../../../core';
import { createLingxiaoNode } from '../../../shared/createLingxiaoNode';
import { addLingxiaoPassive } from '../../../shared/SwordNodePassives';
import { swiftSwordBuild } from '../SwiftSwordBuildFacade';

export const SWIFT_LAYER_4_NODES = [
  createLingxiaoNode(
    {
      id: 'swift-mountain-breaking',
      layerId: '4',
      name: '破岳一线',
      description: '一线天消费剑痕产生无视防御的附加物理伤害。',
    },
    (_context, builder) => swiftSwordBuild(builder).enable('mountainBreaking'),
  ),
  createLingxiaoNode(
    {
      id: 'swift-life-chasing',
      layerId: '4',
      name: '追命一线',
      description: '目标气血低于25%时收束伤害提高30%。',
    },
    (context, builder) =>
      addLingxiaoPassive(context, builder, {
        id: 'swift-life-chasing',
        name: '追命一线',
        listeners: [
          {
            id: 'sect.lingxiao.swift-life-chasing.damage',
            eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
            scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
            priority: DAMAGE_MODIFIER_PRIORITY,
            mapping: { caster: 'owner', target: 'event.target' },
            effects: [
              {
                type: 'percent_damage_modifier',
                params: { mode: 'increase', value: 0.3 },
                conditions: [
                  {
                    type: 'ability_has_tag',
                    params: { tag: GameplayTags.ABILITY.SECT.FINISHER },
                  },
                  {
                    type: 'hp_below',
                    params: { value: 0.25, scope: 'target' },
                  },
                ],
              },
            ],
          },
        ],
      }),
  ),
  createLingxiaoNode(
    {
      id: 'swift-sheathing',
      layerId: '4',
      name: '归鞘一线',
      description: '收束伤害降低20%，返还1点剑势并获得护盾。',
    },
    (_context, builder) => swiftSwordBuild(builder).enable('sheathing'),
  ),
] as const;
