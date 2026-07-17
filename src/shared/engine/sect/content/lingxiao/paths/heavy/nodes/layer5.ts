import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { DAMAGE_MODIFIER_PRIORITY } from '../../../../../core';
import { createLingxiaoNode } from '../../../shared/createLingxiaoNode';
import { addLingxiaoPassive } from '../../../shared/SwordNodePassives';
import { heavySwordBuild } from '../HeavySwordBuildFacade';

export const HEAVY_LAYER_5_NODES = [
  createLingxiaoNode(
    { id: 'heavy-aftershock', layerId: '5', name: '裂岳', description: '《剑破万法》获得20%穿防。' },
    (_context, builder) => heavySwordBuild(builder).enable('rendingMountain'),
  ),
  createLingxiaoNode(
    { id: 'heavy-linked-mountains', layerId: '5', name: '断命', description: '目标气血低于25%时，《剑破万法》造成的伤害提高25%。' },
    (context, builder) => addLingxiaoPassive(context, builder, {
      id: 'heavy-linked-mountains', name: '断命', listeners: [{
        id: 'sect.lingxiao.heavy.life-ending', eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
        scope: GameplayTags.SCOPE.OWNER_AS_CASTER, priority: DAMAGE_MODIFIER_PRIORITY,
        mapping: { caster: 'owner', target: 'event.target' },
        conditions: [
          { type: 'ability_has_tag', params: { tag: GameplayTags.ABILITY.SECT.FINISHER } },
          { type: 'hp_below', params: { value: 0.25, scope: 'target' } },
        ],
        effects: [{ type: 'percent_damage_modifier', params: { mode: 'increase', value: 0.25 } }],
      }],
      presentationModifiers: [{
        abilityId: 'sect-ultimate',
        factRows: ['经脉·断命：目标气血低于25%时，《剑破万法》造成的伤害提高25%'],
      }],
    }),
  ),
  createLingxiaoNode(
    { id: 'heavy-steady-mountain', layerId: '5', name: '回峰', description: '《剑破万法》伤害降低15%，施展后返还2点剑势，并获得相当于60%物攻的护盾。' },
    (_context, builder) => heavySwordBuild(builder).enable('returningPeak'),
  ),
] as const;
