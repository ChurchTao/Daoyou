import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import type { EffectConfig, ListenerConfig } from '@shared/engine/battle-v5/core/configs';
import { EventPriorityLevel } from '@shared/engine/battle-v5/core/events';
import { BuffType, DamageSource } from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { SectAbilityFactory, type SectCompiledAbility } from '../../../../core';
import type { WuxiangBuildSettings } from '../../shared/buildFacades';
import type { WuxiangCompilerApi } from '../../shared/compiler';

export function compileMirrorAbilities(
  features: WuxiangBuildSettings,
  api: WuxiangCompilerApi,
): Record<string, SectCompiledAbility> {
  const {
    KARMA_DOOR, MIRROR_OBSERVE_COUNTER, MIRROR_REED_COUNTER, MIRROR_REFLOW,
    MIRROR_SECOND_OBSERVE,
    WUXIANG_MIRROR_PATH_ID, addKarma, addKarmaLayers,
    allKarmaEffect, buff, directGuard, gainWar, heal, heartVow, karmaDoors,
    layeredAbility, mirrorPresent, physical, selfBuff, shield, targetBuff, tideGuard,
  } = api;
  const formCompletion: EffectConfig[] = [
    ...(features.mirrorFormlessKarmaLayers > 0
      ? addKarmaLayers(features.mirrorFormlessKarmaLayers)
      : []),
    ...(features.mirrorFormlessWarRefund > 0
      ? [gainWar(features.mirrorFormlessWarRefund)]
      : []),
  ];
  const formDone = (effects: EffectConfig[] = []): EffectConfig[] => [...effects, ...formCompletion];
  const flower = layeredAbility({
    id: 'flower-heart', pathId: WUXIANG_MIRROR_PATH_ID, cost: 0.05, target: 'enemy', features,
    effects: [physical(0.6)],
    completionEffects: [heartVow(features.mirrorVowReduction)],
    demonName: '花落问罪',
    demonDescription: '佛相立戒仍然结算；若有业痕，再以花落问罪追加伤害，并封闭目标一门伤害神通。',
    demonEffects: mirrorPresent([
      physical(0.35),
      { type: 'ability_lock', params: { rounds: 1, tags: [GameplayTags.ABILITY.FUNCTION.DAMAGE], maxCount: 1 } },
    ], features, 'enemy'),
    formlessName: '心花两忘',
    formlessDescription: '拈花、问罪与无相同时结算；无论现报是否成功，技能结束后重新留下1层业痕。',
    formlessEffects: [physical(0.3), ...allKarmaEffect(features, 'enemy')],
    formlessCompletionEffects: formDone([addKarma()]),
  });
  const blood = layeredAbility({
    id: 'blood-tide', pathId: WUXIANG_MIRROR_PATH_ID, cost: 0.08, target: 'self', features,
    effects: [shield(0.08), tideGuard(features.mirrorTideReduction)],
    demonName: '血海回澜',
    demonDescription: '佛相护身仍然结算；若有业痕，回澜恢复气血，并在听潮受击时照还一击。',
    demonEffects: mirrorPresent([
      heal(0.03),
      selfBuff(buff(MIRROR_REFLOW, '回澜', 1, [], { dispelPolicy: 'protected' })),
    ], features, 'self'),
    formlessName: '海月同潮',
    formlessDescription: '听潮、回澜与海月同现；额外获得护盾，使此身在潮中仍有立足之处。',
    formlessEffects: [shield(0.06), ...allKarmaEffect(features, 'self')],
    formlessCompletionEffects: formDone(),
  });
  const doorLayers = features.mirrorDoorLayers;
  const knocks = layeredAbility({
    id: 'three-knocks', pathId: WUXIANG_MIRROR_PATH_ID, cost: 0.07, target: 'enemy', features,
    effects: [physical(0.28), physical(0.28), physical(0.28)],
    completionEffects: karmaDoors(doorLayers),
    demonName: '业门倒叩',
    demonDescription: '佛相三叩仍然结算；若有业痕，再倒叩旧门，按旧业门层数逐扇引爆。',
    demonEffects: mirrorPresent([{
      type: 'consume_status_trigger',
      params: {
        match: { id: KARMA_DOOR }, displayName: '业门', consume: 'all', target: 'target',
        effects: [physical(0.25)], scaleEffectsByLayer: true,
      },
    }], features, 'enemy'),
    formlessName: '门内无人',
    formlessDescription: '三叩、倒叩皆归无相；旧门尽空之处再落一击，技能结束后仍由佛相留下新的业门。',
    formlessEffects: [physical(0.35), ...allKarmaEffect(features, 'enemy')],
    formlessCompletionEffects: formDone(),
  });
  const observeReduction = features.mirrorObserveReduction;
  const observe = layeredAbility({
    id: 'observe-calamity', pathId: WUXIANG_MIRROR_PATH_ID, cost: 0.1, target: 'self', features,
    effects: [directGuard(
      'sect.wuxiang.mirror.observe',
      '观劫',
      observeReduction,
      {
        counter: 0.45,
        counterMarker: MIRROR_OBSERVE_COUNTER,
        secondTriggerMarker: MIRROR_SECOND_OBSERVE,
      },
    )],
    demonName: '开眼见劫',
    demonDescription: '佛相观劫仍然结算；若有业痕，开眼之时照见来者，每次成功减伤后反击。',
    demonEffects: mirrorPresent([
      selfBuff(buff(MIRROR_OBSERVE_COUNTER, '开眼见劫', 1, [], {
        dispelPolicy: 'protected', stackRule: StackRule.STACK_LAYER, maxLayers: 2,
      })),
    ], features, 'self'),
    formlessName: '劫相俱寂',
    formlessDescription: '闭目与开眼本无分别；观劫可承受两次直接伤害，两次皆可触发魔相反击。',
    formlessEffects: [
      selfBuff(buff(MIRROR_SECOND_OBSERVE, '劫相俱寂', 1, [], { dispelPolicy: 'protected' })),
      selfBuff(buff(MIRROR_OBSERVE_COUNTER, '开眼见劫', 1, [], {
        dispelPolicy: 'protected', stackRule: StackRule.STACK_LAYER, maxLayers: 2,
      })),
      ...allKarmaEffect(features, 'self'),
    ],
    formlessCompletionEffects: formDone(),
  });
  const fade = targetBuff(buff('sect.wuxiang.mirror.skandhas-fade', '五蕴衰', 1, [{
    id: 'sect.wuxiang.mirror.skandhas-fade.trigger',
    eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
    scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
    priority: EventPriorityLevel.DAMAGE_REQUEST + 1,
    mapping: { caster: 'owner', target: 'event.target' },
    guard: { skipSecondaryDamageSource: true },
    budget: { maxTriggers: 1, reset: 'buff_lifetime' },
    conditions: [{ type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } }],
    effects: [{ type: 'percent_damage_modifier', params: { mode: 'reduce', value: 0.08 } }],
  }], { type: BuffType.DEBUFF, tags: [GameplayTags.BUFF.TYPE.DEBUFF] }));
  const skandhas = layeredAbility({
    id: 'five-skandhas', pathId: WUXIANG_MIRROR_PATH_ID, cost: 0.06, target: 'enemy', features,
    effects: [
      physical(0.5),
      {
        type: 'dispel',
        params: {
          status: 'positive', maxCount: 1,
          effects: addKarmaLayers(features.mirrorSkandhasKarmaLayers),
          fallbackEffects: [fade],
        },
      },
    ],
    demonName: '五蕴还照',
    demonDescription: '佛相照破外法仍然结算；若有业痕，再将镜光还照自身，净化一个可移除减益。',
    demonEffects: mirrorPresent([{
      type: 'dispel', params: { recipient: 'caster', status: 'negative', maxCount: 1 },
    }], features, 'enemy'),
    formlessName: '五蕴皆空',
    formlessDescription: '外法、内执一并照空；追加伤害，并以空相护住色身。',
    formlessEffects: [physical(0.4), shield(0.05), ...allKarmaEffect(features, 'enemy')],
    formlessCompletionEffects: formDone(),
  });
  const reed = layeredAbility({
    id: 'reed-crossing', pathId: WUXIANG_MIRROR_PATH_ID, cost: 0.08, target: 'self', features,
    effects: [directGuard(
      'sect.wuxiang.mirror.reed',
      '彼岸',
      features.mirrorReedReduction,
      { counter: 0.55, counterMarker: MIRROR_REED_COUNTER },
    )],
    demonName: '一苇倒渡',
    demonDescription: '佛相彼岸仍然结算；若有业痕，来力触岸之后顺势倒渡，照还攻击者。',
    demonEffects: mirrorPresent([
      selfBuff(buff(MIRROR_REED_COUNTER, '一苇倒渡', 1, [], { dispelPolicy: 'protected' })),
    ], features, 'self'),
    formlessName: '此岸非岸',
    formlessDescription: '此岸与彼岸皆非定相；获得护盾，再以一苇承住来力与倒渡。',
    formlessEffects: [shield(0.1), ...allKarmaEffect(features, 'self')],
    formlessCompletionEffects: formDone(),
  });
  return {
    'flower-heart': flower,
    'blood-tide': blood,
    'three-knocks': knocks,
    'observe-calamity': observe,
    'five-skandhas': skandhas,
    'reed-crossing': reed,
  };
}

export function compileMirrorPassive(
  features: WuxiangBuildSettings,
  api: WuxiangCompilerApi,
): SectCompiledAbility {
  const {
    WUXIANG_KARMA_BUFF, WUXIANG_MIRROR_PATH_ID, WUXIANG_SECT_ID,
    addKarma, modeIs, passiveDefinition,
  } = api;
  const factory = new SectAbilityFactory(WUXIANG_SECT_ID);
  const perLayer = features.mirrorReflectPerLayer;
  const listeners: ListenerConfig[] = [
    {
      id: 'sect.wuxiang.mirror.mark',
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: 2,
      mapping: { caster: 'owner', target: 'owner' },
      guard: { skipSecondaryDamageSource: true },
      budget: { maxTriggers: 1, reset: 'source_action' },
      conditions: [
        { type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } },
        modeIs('none'),
      ],
      effects: [addKarma()],
    },
    ...(features.mirrorGuestExtraKarma ? [{
      id: 'sect.wuxiang.mirror.guest',
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: 1,
      mapping: { caster: 'owner' as const, target: 'owner' as const },
      guard: { skipSecondaryDamageSource: true },
      budget: { maxTriggers: 1, reset: 'round' as const },
      conditions: [
        { type: 'damage_source_is' as const, params: { damageSource: DamageSource.DIRECT } },
        modeIs('none'),
      ],
      effects: [addKarma()],
    }] : []),
    {
      id: 'sect.wuxiang.mirror.reflect',
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: 0,
      mapping: { caster: 'event.caster', target: 'owner' },
      guard: { skipSecondaryDamageSource: true },
      conditions: [
        { type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } },
        { ...modeIs('none'), params: { ...modeIs('none').params, scope: 'target' } },
      ],
      effects: [
        { type: 'reflect', params: { ratio: 0.05, ratioPerLayer: perLayer, layerBuffId: WUXIANG_KARMA_BUFF } },
        ...(features.mirrorFullReflectBonus > 0 ? [{
          type: 'reflect' as const,
          conditions: [{
            type: 'buff_layer_at_least' as const,
            params: { scope: 'target' as const, id: WUXIANG_KARMA_BUFF, value: 3 },
          }],
          params: { ratio: features.mirrorFullReflectBonus },
        }] : []),
      ],
    },
  ];
  if (features.mirrorFullDamageReduction > 0) {
    listeners.push({
      id: 'sect.wuxiang.mirror.full-reduce',
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: EventPriorityLevel.DAMAGE_REQUEST + 1,
      mapping: { caster: 'owner', target: 'owner' },
      guard: { skipSecondaryDamageSource: true },
      conditions: [
        modeIs('none'),
        { type: 'buff_layer_at_least', params: { scope: 'target', id: WUXIANG_KARMA_BUFF, value: 3 } },
      ],
      effects: [{
        type: 'percent_damage_modifier',
        params: { mode: 'reduce', value: features.mirrorFullDamageReduction },
      }],
    });
  }
  return factory.passive({
    definition: passiveDefinition('mirror-core'),
    pathId: WUXIANG_MIRROR_PATH_ID,
    listeners,
  });
}
