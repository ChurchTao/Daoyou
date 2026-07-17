import { AttributeType, DamageSource } from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { sectEffects } from '../../../../../core';
import { createLingxiaoNode } from '../../../shared/createLingxiaoNode';
import { LINGXIAO_SWORD_MOMENTUM } from '../../../shared/LingxiaoMechanics';
import { addLingxiaoPassive } from '../../../shared/SwordNodePassives';

const shieldHitConditions = [
  { type: 'damage_source_is' as const, params: { damageSource: DamageSource.DIRECT } },
  { type: 'shield_absorbed_at_least' as const, params: { value: 1 } },
];

export const HEAVY_LAYER_4_NODES = [
  createLingxiaoNode(
    { id: 'heavy-rending-mountain', layerId: '4', name: '横关', description: '每回合首次以护盾吸收直接伤害时，反击造成相当于75%物攻的伤害，并获得1点剑势。' },
    (context, builder) => addLingxiaoPassive(context, builder, {
      id: 'heavy-rending-mountain', name: '横关', listeners: [{
        id: 'sect.lingxiao.heavy.crossbar', eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: 0,
        mapping: { caster: 'owner', target: 'event.caster' }, budget: { maxTriggers: 1, reset: 'round' },
        guard: { skipSecondaryDamageSource: true }, conditions: shieldHitConditions,
        effects: [
          sectEffects.physicalDamage(0.75, undefined, false, DamageSource.COUNTER),
          sectEffects.modifyResource(LINGXIAO_SWORD_MOMENTUM, 1),
        ],
      }],
    }),
  ),
  createLingxiaoNode(
    { id: 'heavy-ending-life', layerId: '4', name: '借力', description: '返还本次护盾吸收量30%的伤害，反击伤害不超过相当于90%物攻。' },
    (context, builder) => addLingxiaoPassive(context, builder, {
      id: 'heavy-ending-life', name: '借力', listeners: [{
        id: 'sect.lingxiao.heavy.borrow-force', eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: 0,
        mapping: { caster: 'owner', target: 'event.caster' },
        guard: { skipSecondaryDamageSource: true }, conditions: shieldHitConditions,
        effects: [
          {
            type: 'damage_memory',
            params: {
              key: 'sect.lingxiao.heavy.borrow-force', mode: 'record', event: 'shield_absorbed',
              target: 'caster', maxStoredValue: { attribute: AttributeType.ATK, coefficient: 3 },
            },
          },
          {
            type: 'damage_memory',
            params: {
              key: 'sect.lingxiao.heavy.borrow-force', mode: 'release', ratio: 0.3,
              releaseAs: 'counter', target: 'caster', consume: true,
            },
          },
        ],
      }],
    }),
  ),
  createLingxiaoNode(
    { id: 'heavy-returning-peak', layerId: '4', name: '震锋', description: '每回合首次受到直接伤害时，反击造成相当于55%物攻的伤害，并驱散敌方1个正面状态。' },
    (context, builder) => addLingxiaoPassive(context, builder, {
      id: 'heavy-returning-peak', name: '震锋', listeners: [{
        id: 'sect.lingxiao.heavy.shocking-edge', eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: 0,
        mapping: { caster: 'owner', target: 'event.caster' }, budget: { maxTriggers: 1, reset: 'round' },
        guard: { skipSecondaryDamageSource: true },
        conditions: [{ type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } }],
        effects: [
          sectEffects.physicalDamage(0.55, undefined, false, DamageSource.COUNTER),
          { type: 'dispel', params: { targetTag: GameplayTags.BUFF.TYPE.BUFF, maxCount: 1 } },
        ],
      }],
    }),
  ),
] as const;
