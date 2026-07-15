import { DamageSource } from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { DAMAGE_MODIFIER_PRIORITY, DIRECT_DAMAGE_CONDITION, sectEffects } from '../../../../../core';
import { createLingxiaoNode } from '../../../shared/createLingxiaoNode';
import { addLingxiaoPassive } from '../../../shared/SwordNodePassives';
import { heavySwordBuild } from '../HeavySwordBuildFacade';

export const HEAVY_LAYER_3_NODES = [
  createLingxiaoNode(
    { id: 'heavy-crossing-pass', layerId: '3', name: '山门', description: '镇岳步护盾提高50%。' },
    (_context, builder) => heavySwordBuild(builder).enable('mountainGate'),
  ),
  createLingxiaoNode(
    { id: 'heavy-borrowed-weight', layerId: '3', name: '回澜', description: '护盾破裂时反击0.75物攻，每回合一次。' },
    (context, builder) => addLingxiaoPassive(context, builder, {
      id: 'heavy-borrowed-weight', name: '回澜', listeners: [{
        id: 'sect.lingxiao.heavy.returning-wave', eventType: 'ShieldBreakEvent',
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: 0,
        mapping: { caster: 'owner', target: 'event.caster' }, budget: { maxTriggers: 1, reset: 'round' },
        guard: { skipSecondaryDamageSource: true },
        effects: [sectEffects.physicalDamage(0.75, undefined, false, DamageSource.COUNTER)],
      }],
    }),
  ),
  createLingxiaoNode(
    { id: 'heavy-unmoved', layerId: '3', name: '固守', description: '有护盾时直接承伤降低10%。' },
    (context, builder) => addLingxiaoPassive(context, builder, {
      id: 'heavy-unmoved', name: '固守', listeners: [{
        id: 'sect.lingxiao.heavy.solid-guard', eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: DAMAGE_MODIFIER_PRIORITY,
        mapping: { caster: 'owner', target: 'owner' }, guard: { skipSecondaryDamageSource: true },
        conditions: [DIRECT_DAMAGE_CONDITION, { type: 'has_shield', params: { scope: 'caster', value: 0 } }],
        effects: [{ type: 'percent_damage_modifier', params: { mode: 'reduce', value: 0.1 } }],
      }],
    }),
  ),
] as const;
