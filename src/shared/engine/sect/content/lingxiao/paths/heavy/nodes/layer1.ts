import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { DAMAGE_MODIFIER_PRIORITY, DIRECT_DAMAGE_CONDITION, sectEffects } from '../../../../../core';
import { createLingxiaoNode } from '../../../shared/createLingxiaoNode';
import { LINGXIAO_SWORD_MOMENTUM } from '../../../shared/LingxiaoMechanics';
import { addLingxiaoPassive } from '../../../shared/SwordNodePassives';
import { heavySwordBuild } from '../HeavySwordBuildFacade';

export const HEAVY_LAYER_1_NODES = [
  createLingxiaoNode(
    { id: 'heavy-opening', layerId: '1', name: '立地', description: '开场获得2剑势和0.35物攻护盾。' },
    (context, builder) => {
      heavySwordBuild(builder).enable('opening');
      addLingxiaoPassive(context, builder, {
        id: 'heavy-opening', name: '立地', listeners: [{
          id: 'sect.lingxiao.heavy.opening', eventType: 'BattleInitEvent',
          scope: GameplayTags.SCOPE.GLOBAL, priority: 0,
          mapping: { caster: 'owner', target: 'owner' }, budget: { maxTriggers: 1, reset: 'battle' },
          effects: [sectEffects.shieldByAttack(0.35, undefined, 'caster')],
        }],
      });
    },
  ),
  createLingxiaoNode(
    { id: 'heavy-hidden-weight', layerId: '1', name: '承锋', description: '首次直接承伤降低15%，并获得2剑势。' },
    (context, builder) => addLingxiaoPassive(context, builder, {
      id: 'heavy-hidden-weight', name: '承锋', listeners: [{
        id: 'sect.lingxiao.heavy.bearing-edge', eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: DAMAGE_MODIFIER_PRIORITY,
        mapping: { caster: 'owner', target: 'owner' }, budget: { maxTriggers: 1, reset: 'battle' },
        guard: { skipSecondaryDamageSource: true }, conditions: [DIRECT_DAMAGE_CONDITION],
        effects: [
          { type: 'percent_damage_modifier', params: { mode: 'reduce', value: 0.15 } },
          sectEffects.modifyResource(LINGXIAO_SWORD_MOMENTUM, 2),
        ],
      }],
    }),
  ),
  createLingxiaoNode(
    { id: 'heavy-testing-frame', layerId: '1', name: '守拙', description: '每回合首次护盾承伤额外获得1剑势。' },
    (context, builder) => addLingxiaoPassive(context, builder, {
      id: 'heavy-testing-frame', name: '守拙', listeners: [{
        id: 'sect.lingxiao.heavy.simple-guard', eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: 0,
        mapping: { caster: 'owner', target: 'owner' }, budget: { maxTriggers: 1, reset: 'round' },
        guard: { skipSecondaryDamageSource: true },
        conditions: [DIRECT_DAMAGE_CONDITION, { type: 'shield_absorbed_at_least', params: { value: 1 } }],
        effects: [sectEffects.modifyResource(LINGXIAO_SWORD_MOMENTUM, 1)],
      }],
    }),
  ),
] as const;
