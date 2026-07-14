import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { DAMAGE_MODIFIER_PRIORITY } from '../../../../../core';
import { createLingxiaoNode } from '../../../shared/createLingxiaoNode';
import { addLingxiaoPassive } from '../../../shared/SwordNodePassives';
import { heavySwordBuild } from '../HeavySwordBuildFacade';

export const HEAVY_LAYER_4_NODES = [
  createLingxiaoNode(
    {
      id: 'heavy-rending-mountain',
      layer: 4,
      name: '裂岳',
      description: '破岳式消费裂甲时，每层追加0.18物攻无视防御伤害。',
    },
    (_context, builder) => heavySwordBuild(builder).enable('rendingMountain'),
  ),
  createLingxiaoNode(
    {
      id: 'heavy-ending-life',
      layer: 4,
      name: '断命',
      description: '目标气血低于25%时收束伤害提高30%。',
    },
    (context, builder) =>
      addLingxiaoPassive(context, builder, {
        id: 'heavy-ending-life',
        name: '断命',
        listeners: [
          {
            id: 'sect.lingxiao.heavy-ending-life.damage',
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
      id: 'heavy-returning-peak',
      layer: 4,
      name: '回峰',
      description: '收束伤害降低20%，返还2点剑架并获得护盾。',
    },
    (_context, builder) => heavySwordBuild(builder).enable('returningPeak'),
  ),
] as const;
