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
      name: '破妄',
      description: '施展《剑破万法》时消耗全部剑痕；每消耗1层，追加一次相当于18%物攻且无视防御的伤害。',
    },
    (_context, builder) => swiftSwordBuild(builder).enable('mountainBreaking'),
  ),
  createLingxiaoNode(
    {
      id: 'swift-life-chasing',
      layerId: '4',
      name: '追命',
      description: '目标气血低于25%时，《剑破万法》造成的伤害提高25%。',
    },
    (context, builder) =>
      addLingxiaoPassive(context, builder, {
        id: 'swift-life-chasing',
        name: '追命',
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
                params: { mode: 'increase', value: 0.25 },
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
        presentationModifiers: [{
          abilityId: 'sect-ultimate',
          factRows: ['参悟·追命：目标气血低于25%时，《剑破万法》造成的伤害提高25%'],
        }],
      }),
  ),
  createLingxiaoNode(
    {
      id: 'swift-sheathing',
      layerId: '4',
      name: '归鞘',
      description: '《剑破万法》伤害降低15%，施展后返还1点剑势，并获得相当于50%物攻的护盾。',
    },
    (_context, builder) => swiftSwordBuild(builder).enable('sheathing'),
  ),
] as const;
