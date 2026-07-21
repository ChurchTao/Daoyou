import type { ConditionConfig, EffectConfig, ListenerConfig } from '@shared/engine/battle-v5/core/configs';
import { DamageSource } from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { SectAbilityFactory, type SectCompiledAbility } from '../../../../core';
import type { WuxiangBuildSettings } from '../../shared/buildFacades';
import type { WuxiangCompilerApi } from '../../shared/compiler';

export function compileDemonAbilities(
  features: WuxiangBuildSettings,
  api: WuxiangCompilerApi,
): Record<string, SectCompiledAbility> {
  const {
    WUXIANG_DEMON_PATH_ID, buff, clearBuff, demonCompletion, directGuard,
    firstThoughtBonus, gainWar, heal, heartGap, layeredAbility, outgoingBoost,
    physical, selfBuff, shield,
  } = api;
  const bDone = () => demonCompletion(features, 'demon');
  const cDone = () => demonCompletion(features, 'formless');
  const first = (target: 'enemy' | 'self'): EffectConfig[] =>
    features.demonFirstThought ? [firstThoughtBonus(target)] : [];
  const heartBonus = features.demonHeartGapBonus;
  const flower = layeredAbility({
    id: 'flower-heart', pathId: WUXIANG_DEMON_PATH_ID, cost: 0.06, target: 'enemy', features,
    effects: [physical(0.6)],
    completionEffects: [heartGap(heartBonus)],
    demonName: '摘心问魔',
    demonDescription: '佛相叩心仍然结算；再以魔相摘心追加一击，并在技能结束后多留一层心隙。',
    demonEffects: [...first('enemy'), physical(0.35)],
    demonCompletionEffects: [heartGap(heartBonus), ...bDone()],
    formlessName: '心魔两忘',
    formlessDescription: '叩心与摘心同时显化，再按目标已损气血完成收束；技能结束后仍留下两层心隙。',
    formlessEffects: [physical(0, undefined, {
      dynamicMissingHpCap: features.demonOneFurnace ? 0.6 : 0.4,
    })],
    formlessCompletionEffects: cDone(),
  });
  const tideBaseBonus = features.demonTideDamageBonus;
  const tideShield = features.demonTideShieldRatio;
  const blood = layeredAbility({
    id: 'blood-tide', pathId: WUXIANG_DEMON_PATH_ID, cost: 0.14, target: 'self', features,
    effects: [shield(tideShield), outgoingBoost('sect.wuxiang.demon.blood-tide-boost', '血潮', tideBaseBonus)],
    demonName: '血海倒悬',
    demonDescription: '佛相血潮仍然结算；魔相令血海倒悬，护盾加厚，并在血潮命中时回收一部分气血。',
    demonEffects: [
      ...first('self'),
      shield(0.05),
      clearBuff('sect.wuxiang.demon.blood-tide-boost'),
      outgoingBoost('sect.wuxiang.demon.blood-tide-boost', '血潮', tideBaseBonus, { healOnHit: 0.03 }),
    ],
    demonCompletionEffects: bDone(),
    formlessName: '血海无涯',
    formlessDescription: '血海无涯，沉血与回生同时发生；恢复气血，并令下一门直接伤害获得更强血潮。',
    formlessEffects: [
      heal(features.demonOneFurnace ? 0.08 : 0.05),
      clearBuff('sect.wuxiang.demon.blood-tide-boost'),
      outgoingBoost('sect.wuxiang.demon.blood-tide-boost', '血海无涯', 0.3, { healOnHit: 0.03 }),
    ],
    formlessCompletionEffects: cDone(),
  });
  const lowThreshold = features.demonThirdHitThreshold;
  const lowCondition: ConditionConfig[] = [{
    type: 'hp_below', params: { scope: 'caster', value: lowThreshold, timing: 'cast' },
  }];
  const knocks = layeredAbility({
    id: 'three-knocks', pathId: WUXIANG_DEMON_PATH_ID, cost: 0.09, target: 'enemy', features,
    effects: [physical(0.25), physical(0.25), physical(0.25), physical(0.25, lowCondition)],
    demonName: '三叩魔关',
    demonDescription: '佛相三叩仍然结算；魔相再叩一门，以第四击强渡魔关。',
    demonEffects: [...first('enemy'), physical(0.45)],
    demonCompletionEffects: bDone(),
    formlessName: '业门无生',
    formlessDescription: '三叩与魔关一并显化；濒危时再追加一次必定暴击的无生之击。',
    formlessEffects: [physical(
      features.demonOneFurnace ? 0.85 : 0.65,
      [{ type: 'hp_below', params: { scope: 'caster', value: 0.35, timing: 'cast' } }],
      { forceCritical: true },
    )],
    formlessCompletionEffects: cDone(),
  });
  const observe = layeredAbility({
    id: 'observe-calamity', pathId: WUXIANG_DEMON_PATH_ID, cost: 0.11, target: 'self', features,
    effects: [directGuard(
      'sect.wuxiang.demon.observe',
      '承劫',
      features.demonObserveReduction,
      { counter: 0.4, counterMarker: 'sect.wuxiang.demon.observe-counter' },
    )],
    demonName: '开眼见魔',
    demonDescription: '佛相承劫仍然结算；开眼见魔，承受来力之后立即反击。',
    demonEffects: [
      ...first('self'),
      selfBuff(buff('sect.wuxiang.demon.observe-counter', '开眼见魔', 1, [], { dispelPolicy: 'protected' })),
    ],
    demonCompletionEffects: bDone(),
    formlessName: '劫火自明',
    formlessDescription: '劫火不再成为债务，而在当下照明自身；获得护盾，并同时保留承劫与反击。',
    formlessEffects: [shield(features.demonOneFurnace ? 0.12 : 0.08)],
    formlessCompletionEffects: cDone(),
  });
  const cleanseCount = features.demonCleanseCount;
  const skandhas = layeredAbility({
    id: 'five-skandhas', pathId: WUXIANG_DEMON_PATH_ID, cost: 0.07, target: 'self', features,
    effects: [{
      type: 'dispel',
      params: { recipient: 'caster', status: 'negative', maxCount: cleanseCount, effects: [gainWar()] },
    }],
    demonName: '焚尽五蕴',
    demonDescription: '佛相净化仍然结算；魔相以五蕴作薪，获得护盾并强化下一门宗门直接伤害。',
    demonEffects: [
      ...first('self'),
      shield(0.06),
      outgoingBoost('sect.wuxiang.demon.skandhas-boost', '焚尽五蕴', 0.2),
    ],
    demonCompletionEffects: bDone(),
    formlessName: '蕴空身在',
    formlessDescription: '净化与焚尽同时结算；再移除一个减益，诸蕴虽空，色身仍在。',
    formlessEffects: [
      { type: 'dispel', params: { recipient: 'caster', status: 'negative', maxCount: 1 } },
      ...(features.demonOneFurnace ? [heal(0.05)] : []),
    ],
    formlessCompletionEffects: cDone(),
  });
  const baseReedReduction = features.demonReedReduction;
  const reed = layeredAbility({
    id: 'reed-crossing', pathId: WUXIANG_DEMON_PATH_ID, cost: 0.1, target: 'self', features,
    effects: [shield(0.1), directGuard('sect.wuxiang.demon.reed', '血舟', baseReedReduction)],
    demonName: '一苇渡厄',
    demonDescription: '佛相血舟仍然结算；魔相强渡，使护盾更厚、下一次直接伤害减免更高。',
    demonEffects: [
      ...first('self'),
      shield(0.05),
      directGuard(
        'sect.wuxiang.demon.reed-extra',
        '一苇渡厄',
        0.1,
      ),
    ],
    demonCompletionEffects: bDone(),
    formlessName: '苦海无舟',
    formlessDescription: '有舟无舟皆可横渡；濒危时恢复气血，并同时获得佛相与魔相的双重防护。',
    formlessEffects: [heal(
      features.demonOneFurnace ? 0.08 : 0.05,
      [{ type: 'hp_below', params: { scope: 'caster', value: 0.3, timing: 'cast' } }],
    )],
    formlessCompletionEffects: cDone(),
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

export function compileDemonPassive(
  features: WuxiangBuildSettings,
  api: WuxiangCompilerApi,
): SectCompiledAbility {
  const {
    DEMON_CONTROL_GUARD, WUXIANG_DEMON_PATH_ID, WUXIANG_SECT_ID, buff, heal,
    passiveDefinition, selfBuff, shield, techniqueTag,
  } = api;
  const factory = new SectAbilityFactory(WUXIANG_SECT_ID);
  const thresholdListener = (
    id: string,
    threshold: number,
    effects: EffectConfig[],
  ): ListenerConfig => ({
    id,
    eventType: GameplayTags.EVENT.ABILITY_COST_PAID,
    scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
    priority: 2,
    mapping: { caster: 'owner', target: 'owner' },
    budget: { maxTriggers: 1, reset: 'battle' },
    conditions: [
      { type: 'ability_has_exact_tag', params: { tag: techniqueTag } },
      { type: 'ability_cost_crossed', params: { value: threshold } },
    ],
    effects,
  });
  const listeners: ListenerConfig[] = [
    {
      id: 'sect.wuxiang.demon.lifesteal',
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: 0,
      mapping: { caster: 'owner', target: 'event.target' },
      guard: { skipSecondaryDamageSource: true },
      conditions: [
        { type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } },
        { type: 'ability_has_exact_tag', params: { tag: techniqueTag } },
        {
          type: 'buff_layer_at_least',
          params: { scope: 'caster', id: DEMON_CONTROL_GUARD, value: 1 },
        },
      ],
      effects: [{
        type: 'lifesteal',
        params: {
          ratio: 0.25,
          maxHpRatioPerAction: features.demonLifestealCap,
        },
      }],
    },
    ...(features.demonThresholdShield
      ? [thresholdListener('sect.wuxiang.demon.three-shores', 0.35, [shield(0.08)])]
      : []),
    ...(features.demonControlThreshold
      ? [thresholdListener('sect.wuxiang.demon.body-breaks', 0.3, [
          selfBuff(buff('sect.wuxiang.demon.body-breaks-guard', '身坏心明', 1, [{
            id: 'sect.wuxiang.demon.body-breaks-guard.immune',
            eventType: GameplayTags.EVENT.BUFF_ADD,
            scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
            priority: 100,
            mapping: { caster: 'owner', target: 'owner' },
            effects: [{ type: 'buff_immunity', params: { tags: [GameplayTags.BUFF.TYPE.CONTROL] } }],
          }], { dispelPolicy: 'protected' })),
        ])]
      : []),
    ...(features.demonLowHpHealThreshold
      ? [thresholdListener('sect.wuxiang.demon.blood-empty', 0.25, [heal(0.05)])]
      : []),
  ];
  return factory.passive({
    definition: passiveDefinition('demon-core'),
    pathId: WUXIANG_DEMON_PATH_ID,
    listeners,
  });
}
