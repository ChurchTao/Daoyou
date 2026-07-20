import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import type {
  AbilityCostConfig,
  AbilityVariantConfig,
  BuffConfig,
  ConditionConfig,
  EffectConfig,
  ListenerConfig,
} from '@shared/engine/battle-v5/core/configs';
import { EventPriorityLevel } from '@shared/engine/battle-v5/core/events';
import {
  AttributeType,
  BuffType,
  DamageSource,
  DamageType,
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import {
  SectAbilityFactory,
  type SectBuildBuilder,
  type SectCompiledAbility,
  type SectPathId,
  type SectProjectionContext,
} from '../../core';
import { WUXIANG_BASE_DEFINITION } from './definition';
import {
  WUXIANG_BLOOD_TIDE_MEMORY,
  WUXIANG_DEMON_PATH_ID,
  WUXIANG_FORM_MODE,
  WUXIANG_KARMA_BUFF,
  WUXIANG_MIRROR_PATH_ID,
  WUXIANG_SECT_ID,
  WUXIANG_TECHNIQUE_IDS,
  WUXIANG_WAR_INTENT,
  type WuxiangTechniqueId,
} from './ids';

export const WUXIANG_FEATURES = Symbol('wuxiang-features');
export type WuxiangFeatures = Set<string>;

const techniqueTag = GameplayTags.ABILITY.SECT.mechanic(
  WUXIANG_SECT_ID,
  'technique',
);
const demonVariantIds: string[] = [];

const hpCost = (ratio: number): AbilityCostConfig[] => [
  { resource: 'hp', mode: 'current_hp_ratio', ratio, minimum: 1, retain: 1 },
];
const physical = (
  coefficient: number,
  conditions?: ConditionConfig[],
  forceCritical = false,
  damageSource: DamageSource = DamageSource.DIRECT,
): EffectConfig => ({
  type: 'damage',
  params: {
    value: { attribute: AttributeType.ATK, coefficient },
    damageType: DamageType.PHYSICAL,
    damageSource,
    forceCritical,
  },
  conditions,
});
const gainWar = (amount = 1): EffectConfig => ({
  type: 'combat_resource_modify',
  params: {
    resourceId: WUXIANG_WAR_INTENT,
    operation: 'add',
    amount,
    target: 'caster',
    reason: 'gain',
  },
});
const spendWar = (amount: number | 'all'): EffectConfig => ({
  type: 'combat_resource_modify',
  params: {
    resourceId: WUXIANG_WAR_INTENT,
    operation: amount === 'all' ? 'consume_all' : 'subtract',
    amount: amount === 'all' ? undefined : amount,
    target: 'caster',
    reason: 'spend',
  },
});
const modeCondition = (mode: string, phase?: number): ConditionConfig => ({
  type: 'ability_mode_is',
  params: { scope: 'caster', key: WUXIANG_FORM_MODE, mode, phase },
});
const advanceMode: EffectConfig = {
  type: 'ability_mode',
  params: { key: WUXIANG_FORM_MODE, operation: 'advance' },
};
const MIRROR_RETURN_THOUGHT_BUFF = 'sect.wuxiang.mirror.return-thought';
const DEMON_LEAVE_BOAT_BUFF = 'sect.wuxiang.demon.leave-boat';
const DEMON_CALAMITY_DEBT = 'sect.wuxiang.demon.calamity-debt';
const DEMON_VIRTUAL_DEBT = 'sect.wuxiang.demon.virtual-debt';
const healMaxHp = (ratio: number): EffectConfig => ({
  type: 'heal',
  params: { value: { targetMaxHpRatio: ratio }, recipient: 'caster', target: 'hp' },
});
const addKarma = (target: 'caster' | 'target' = 'caster'): EffectConfig => ({
  type: 'apply_buff',
  params: {
    target,
    buffConfig: {
      id: WUXIANG_KARMA_BUFF,
      name: '业痕',
      description: '来力留痕；佛相反伤随层数提高，魔相可消耗此痕现报。',
      type: BuffType.BUFF,
      duration: -1,
      stackRule: StackRule.STACK_LAYER,
      maxLayers: 3,
      tags: [GameplayTags.BUFF.TYPE.BUFF, GameplayTags.BUFF.SECT.namespace(WUXIANG_SECT_ID, 'karma')],
    },
  },
});
const consumeKarma = (
  effects: EffectConfig[],
  count: number | 'all' = 1,
): EffectConfig => ({
  type: 'consume_status_trigger',
  params: {
    match: { id: WUXIANG_KARMA_BUFF },
    displayName: '业痕',
    consume: count,
    effects,
    scaleEffectsByLayer:
      count === 'all' || (typeof count === 'number' && count > 1),
    target: 'caster',
  },
});
const leaveKarma = (layers = 1): EffectConfig[] => [
  addKarma('caster'),
  {
    type: 'buff_layer_modify',
    params: {
      match: { id: WUXIANG_KARMA_BUFF },
      operation: 'set',
      layers,
      target: 'caster',
    },
  },
];

function buff(
  id: string,
  name: string,
  duration: number,
  listeners: ListenerConfig[],
  options: Partial<BuffConfig> = {},
): BuffConfig {
  return {
    id,
    name,
    type: BuffType.BUFF,
    duration,
    stackRule: StackRule.OVERRIDE,
    tags: [GameplayTags.BUFF.TYPE.BUFF, GameplayTags.BUFF.SECT.namespace(WUXIANG_SECT_ID, id)],
    listeners,
    ...options,
  };
}

const selfBuff = (config: BuffConfig): EffectConfig => ({
  type: 'apply_buff',
  params: { target: 'caster', buffConfig: config },
});
const targetBuff = (config: BuffConfig): EffectConfig => ({
  type: 'apply_buff',
  params: { target: 'target', buffConfig: config },
});

function definition(id: string) {
  const found = WUXIANG_BASE_DEFINITION.abilities.find(
    (ability) => ability.id === id && ability.kind !== 'passive',
  );
  if (!found || found.kind === 'passive') throw new Error(`无相神通未定义: ${id}`);
  return found;
}

function makeAbility(
  id: WuxiangTechniqueId | 'turn-form',
  pathId: SectPathId | undefined,
  variants: AbilityVariantConfig[],
  targetPolicy: { team: 'enemy' | 'self'; scope: 'single' },
): SectCompiledAbility {
  const factory = new SectAbilityFactory(WUXIANG_SECT_ID);
  return factory.active({
    definition: definition(id),
    pathId,
    targetPolicy,
    effects: [],
    variants,
    extraTags: id === 'turn-form' ? [] : [techniqueTag],
    selectionProfile: id === 'turn-form' ? { intents: ['buff'] } : undefined,
    castConditions:
      id === 'turn-form'
        ? [{
            type: 'combat_resource_at_least',
            params: { scope: 'caster', resourceId: WUXIANG_WAR_INTENT, value: 3 },
          }]
        : undefined,
  });
}

function mirrorGuardBuff(reduction: number): EffectConfig {
  return selfBuff(buff('sect.wuxiang.mirror.observe', '闭目观劫', 1, [
    {
      id: 'sect.wuxiang.mirror.observe.first',
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: EventPriorityLevel.DAMAGE_REQUEST + 1,
      mapping: { caster: 'owner', target: 'owner' },
      guard: { skipSecondaryDamageSource: true },
      budget: { maxTriggers: 1, reset: 'buff_lifetime' },
      conditions: [{ type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } }],
      effects: [{ type: 'percent_damage_modifier', params: { mode: 'reduce', value: reduction } }],
    },
    {
      id: 'sect.wuxiang.mirror.observe.reflect',
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: 0,
      mapping: { caster: 'event.caster', target: 'owner' },
      guard: { skipSecondaryDamageSource: true },
      conditions: [{ type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } }],
      effects: [{ type: 'reflect', params: { ratio: 0.1 } }],
    },
  ]));
}

function redirectBuff(ratio: number): EffectConfig {
  return selfBuff(buff('sect.wuxiang.mirror.redirect', '倒渡', 1, [
    {
      id: 'sect.wuxiang.mirror.redirect.reduce',
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: EventPriorityLevel.DAMAGE_REQUEST + 1,
      mapping: { caster: 'owner', target: 'owner' },
      guard: { skipSecondaryDamageSource: true },
      budget: { maxTriggers: 1, reset: 'buff_lifetime' },
      conditions: [{ type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } }],
      effects: [{ type: 'percent_damage_modifier', params: { mode: 'reduce', value: ratio } }],
    },
    {
      id: 'sect.wuxiang.mirror.redirect.reflect',
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: 0,
      mapping: { caster: 'event.caster', target: 'owner' },
      guard: { skipSecondaryDamageSource: true },
      budget: { maxTriggers: 1, reset: 'buff_lifetime' },
      conditions: [{ type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } }],
      effects: [{ type: 'reflect', params: { ratio } }],
    },
  ]));
}

function damageCapBuff(id: string, name: string, ratio: number): EffectConfig {
  return selfBuff(buff(id, name, 1, [{
    id: `${id}.cap`,
    eventType: GameplayTags.EVENT.DAMAGE,
    scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
    priority: EventPriorityLevel.DAMAGE_APPLY + 1,
    mapping: { caster: 'owner', target: 'owner' },
    guard: { skipSecondaryDamageSource: true },
    budget: { maxTriggers: 1, reset: 'buff_lifetime' },
    effects: [{ type: 'damage_cap', params: { maxHpRatio: ratio, deferOverflowTurns: 1 } }],
  }]));
}

function directReductionBuff(id: string, name: string, reduction: number): EffectConfig {
  return selfBuff(buff(id, name, 1, [{
    id: `${id}.reduce`,
    eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
    scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
    priority: EventPriorityLevel.DAMAGE_REQUEST + 1,
    mapping: { caster: 'owner', target: 'owner' },
    guard: { skipSecondaryDamageSource: true },
    conditions: [{ type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } }],
    effects: [{ type: 'percent_damage_modifier', params: { mode: 'reduce', value: reduction } }],
  }]));
}

function qingHeartVow(reduction: number): EffectConfig {
  return targetBuff(buff(
    'sect.wuxiang.mirror.heart-vow',
    '叩心戒',
    1,
    [{
      id: 'sect.wuxiang.mirror.heart-vow.trigger',
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: EventPriorityLevel.DAMAGE_REQUEST + 1,
      mapping: { caster: 'owner', target: 'event.target' },
      guard: { skipSecondaryDamageSource: true },
      budget: { maxTriggers: 1, reset: 'buff_lifetime' },
      conditions: [{ type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } }],
      effects: [
        { type: 'percent_damage_modifier', params: { mode: 'reduce', value: reduction } },
        addKarma('target'),
      ],
    }],
    { type: BuffType.DEBUFF, tags: [GameplayTags.BUFF.TYPE.DEBUFF] },
  ));
}

function karmaDoor(layers: number): EffectConfig[] {
  const door = buff(
    'sect.wuxiang.mirror.karma-door',
    '业门',
    4,
    [{
      id: 'sect.wuxiang.mirror.karma-door.trigger',
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: 0,
      mapping: { caster: 'event.target', target: 'owner' },
      guard: { skipSecondaryDamageSource: true },
      conditions: [{ type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } }],
      effects: [
        physical(0.12, undefined, false, DamageSource.REFLECT),
        {
          type: 'buff_layer_modify',
          params: {
            match: { id: 'sect.wuxiang.mirror.karma-door' },
            operation: 'subtract',
            layers: 1,
            target: 'target',
          },
        },
      ],
    }],
    {
      type: BuffType.DEBUFF,
      stackRule: StackRule.STACK_LAYER,
      maxLayers: layers,
      tags: [GameplayTags.BUFF.TYPE.DEBUFF],
    },
  );
  return Array.from({ length: layers }, () => targetBuff(door));
}

function mirrorVariants(
  id: WuxiangTechniqueId,
  features: WuxiangFeatures,
): AbilityVariantConfig[] {
  const noformCostBonus = features.has('mirror-formless-two') ? 0.02 : 0;
  const noformKarma = features.has('mirror-formless-two') ? 2 : 1;
  const presentBonus = features.has('mirror-fast-fruit') ? 0.2 : 0;
  const consumeCount = features.has('mirror-all-karma') ? 2 : 1;
  const healOnConsume = features.has('mirror-return-source') ? [healMaxHp(0.02)] : [];
  const present = (effects: EffectConfig[]) => consumeKarma(
    [...effects, ...healOnConsume],
    consumeCount,
  );
  const phaseConditions = [1, 2].map((phase) => modeCondition('demon', phase));
  const variants: AbilityVariantConfig[] = [];
  const addDemon = (
    name: string,
    cost: number,
    baseEffects: EffectConfig[],
    presentEffects: EffectConfig[],
  ) => {
    for (const [index, condition] of phaseConditions.entries()) {
      const phase = index + 1;
      const variantId = `mirror.demon.${index + 1}.${id}`;
      demonVariantIds.push(variantId);
      variants.push({
        id: variantId,
        name,
        priority: 210 - index,
        conditions: [condition],
        costs: hpCost(cost),
        effects: [
          ...baseEffects,
          ...(features.has('mirror-back-demon') && phase === 1
            ? presentEffects
            : [present(presentEffects)]),
          advanceMode,
        ],
        selectionProfile: {
          intents: [...baseEffects, ...presentEffects].some(
            (effect) => effect.type === 'damage',
          ) ? ['damage'] : ['defensive'],
        },
      });
    }
  };
  const addNoform = (
    name: string,
    cost: number,
    effects: EffectConfig[],
    targetPolicy?: AbilityVariantConfig['targetPolicy'],
  ) => variants.push({
    id: `mirror.formless.${id}`,
    name,
    priority: 300,
    conditions: [modeCondition('formless')],
    costs: hpCost(cost + noformCostBonus),
    targetPolicy,
    effects: [
      ...effects,
      ...leaveKarma(noformKarma),
      ...(features.has('mirror-return-thought')
        ? [
            gainWar(2),
            selfBuff(buff(MIRROR_RETURN_THOUGHT_BUFF, '来去一念', -1, [])),
          ]
        : []),
      advanceMode,
    ],
  });

  switch (id) {
    case 'flower-heart': {
      const enhanced = [physical(0.35 + presentBonus), {
        type: 'ability_lock' as const,
        params: { rounds: 1, tags: [GameplayTags.ABILITY.FUNCTION.DAMAGE], maxCount: 1 },
      }];
      addDemon('花落问罪', 0.05, [physical(0.75)], enhanced);
      addNoform('心花两忘', 0.08, [physical(1.1), qingHeartVow(features.has('mirror-loud-flower') ? 0.18 : 0.1), enhanced[1]]);
      variants.push({
        id: 'mirror.buddha.flower-heart', name: '拈花叩心', priority: 0, conditions: [], costs: hpCost(0.05),
        effects: [physical(0.6), qingHeartVow(features.has('mirror-loud-flower') ? 0.18 : 0.1)], castEffects: [gainWar()],
      });
      break;
    }
    case 'blood-tide': {
      const deferRatio = features.has('mirror-welcome-tide') ? 0.4 : 0.3;
      const defer = selfBuff(buff('sect.wuxiang.mirror.tide', '听潮', 1, [{
        id: 'sect.wuxiang.mirror.tide.defer', eventType: GameplayTags.EVENT.DAMAGE,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: EventPriorityLevel.DAMAGE_APPLY + 1,
        mapping: { caster: 'owner', target: 'owner' }, guard: { skipSecondaryDamageSource: true },
        effects: [{ type: 'damage_defer', params: { ratio: deferRatio, delayTurns: 2 } }],
      }]));
      addDemon('血海回澜', 0.06, [physical(0.85)], [healMaxHp(0.03), redirectBuff(0.2)]);
      addNoform('海月同潮', 0.1, [physical(1.05), defer, healMaxHp(0.03), redirectBuff(0.2)], { team: 'enemy', scope: 'single' });
      variants.push({ id: 'mirror.buddha.blood-tide', name: '血海听潮', priority: 0, conditions: [], costs: hpCost(0.08), targetPolicy: { team: 'self', scope: 'single' }, effects: [defer], castEffects: [gainWar()], selectionProfile: { intents: ['defensive'] } });
      break;
    }
    case 'three-knocks': {
      const doorLayers = features.has('mirror-fourth-knock') ? 4 : 3;
      const detonate = [{
        type: 'consume_status_trigger' as const,
        params: {
          match: { id: 'sect.wuxiang.mirror.karma-door' }, consume: 'all' as const,
          effects: [physical(0.32 + presentBonus)], scaleEffectsByLayer: true,
          target: 'target' as const,
        },
      }];
      addDemon('业门倒叩', 0.07, [physical(0.75)], detonate);
      addNoform('门内无人', 0.11, [...karmaDoor(3), { ...detonate[0], params: { ...detonate[0].params, effects: [physical(0.45)] } }]);
      variants.push({ id: 'mirror.buddha.three-knocks', name: '三叩业门', priority: 0, conditions: [], costs: hpCost(0.07), effects: [physical(0.28), physical(0.28), physical(0.28), ...karmaDoor(doorLayers)], castEffects: [gainWar()] });
      break;
    }
    case 'observe-calamity': {
      const guard = mirrorGuardBuff(features.has('mirror-see-guest') ? 0.5 : 0.35);
      const hitBonus = [1, 2, 3].map((hits) => physical(0.22 + presentBonus / 3, [{ type: 'runtime_counter_compare', params: { scope: 'caster', key: 'sect.wuxiang.mirror.hits', value: hits, op: 'gte' } }]));
      addDemon('开眼见劫', 0.06, [physical(0.8)], hitBonus);
      addNoform('劫相俱寂', 0.12, [physical(1.35), guard], { team: 'enemy', scope: 'single' });
      variants.push({ id: 'mirror.buddha.observe-calamity', name: '闭目观劫', priority: 0, conditions: [], costs: hpCost(0.1), targetPolicy: { team: 'self', scope: 'single' }, effects: [guard], castEffects: [gainWar()], selectionProfile: { intents: ['defensive'] } });
      break;
    }
    case 'five-skandhas': {
      const karmaCount = features.has('mirror-skandhas-mark') ? 2 : 1;
      const convert: EffectConfig = {
        type: 'status_transfer',
        params: { operation: 'remove', from: 'target', status: 'positive', maxCount: 1, effects: Array.from({ length: karmaCount }, () => addKarma('caster')) },
      };
      addDemon('五蕴还照', 0.06, [physical(0.75)], [{ type: 'status_transfer', params: { operation: 'move', from: 'caster', to: 'target', status: 'negative', maxCount: 1, fallbackEffects: [physical(0.3 + presentBonus)] } }]);
      addNoform('五蕴皆空', 0.09, [physical(0.95), { type: 'status_transfer', params: { operation: 'remove', from: 'target', status: 'positive', maxCount: 1 } }, { type: 'status_transfer', params: { operation: 'remove', from: 'caster', status: 'negative', maxCount: 1 } }]);
      variants.push({ id: 'mirror.buddha.five-skandhas', name: '照见五蕴', priority: 0, conditions: [], costs: hpCost(0.06), effects: [physical(0.5), convert], castEffects: [gainWar()] });
      break;
    }
    case 'reed-crossing': {
      const cap = features.has('mirror-carry-karma') ? 0.25 : 0.3;
      addDemon('一苇倒渡', 0.07, [], [redirectBuff(0.5)]);
      addNoform('此岸非岸', 0.11, [damageCapBuff('sect.wuxiang.mirror.shore', '彼岸', cap), redirectBuff(0.5)], { team: 'self', scope: 'single' });
      variants.push({ id: 'mirror.buddha.reed-crossing', name: '一苇横江', priority: 0, conditions: [], costs: hpCost(0.08), targetPolicy: { team: 'self', scope: 'single' }, effects: [damageCapBuff('sect.wuxiang.mirror.shore', '彼岸', cap)], castEffects: [gainWar()], selectionProfile: { intents: ['defensive'] } });
      break;
    }
  }
  if (features.has('mirror-vow-body')) {
    const base = variants.find((variant) => variant.id === `mirror.buddha.${id}`);
    const cost = base?.costs?.[0];
    if (base && cost && cost.mode !== 'flat') {
      variants.push({
        ...base,
        id: `mirror.buddha.first.${id}`,
        priority: 10,
        conditions: [
          modeCondition('none'),
          { type: 'runtime_counter_compare', params: { scope: 'caster', key: 'sect.wuxiang.mirror.vow-round', value: 1, op: 'lt' } },
        ],
        costs: hpCost(cost.ratio + 0.02),
        castEffects: [
          ...(base.castEffects ?? []),
          gainWar(),
          { type: 'runtime_counter_modify', params: { key: 'sect.wuxiang.mirror.vow-round', operation: 'set', amount: 1, target: 'caster' } },
        ],
      });
    }
  }
  if (features.has('mirror-return-thought')) {
    const base = variants.find((variant) => variant.id === `mirror.buddha.${id}`);
    const cost = base?.costs?.[0];
    if (base && cost && cost.mode !== 'flat') {
      variants.push({
        ...base,
        id: `mirror.buddha.return-thought.${id}`,
        priority: 20,
        conditions: [
          modeCondition('none'),
          { type: 'buff_layer_at_least', params: { scope: 'caster', id: MIRROR_RETURN_THOUGHT_BUFF, value: 1 } },
        ],
        costs: hpCost(cost.ratio + 0.03),
        effects: [
          ...(base.effects ?? []),
          { type: 'consume_status_trigger', params: { match: { id: MIRROR_RETURN_THOUGHT_BUFF }, displayName: '来去一念', consume: 'all', effects: [], target: 'caster' } },
        ],
      });
    }
  }
  return variants;
}

function demonVariants(
  id: WuxiangTechniqueId,
  features: WuxiangFeatures,
): AbilityVariantConfig[] {
  const entryScale = features.has('demon-first-thought') ? 1.15 : 1;
  const finishScale = features.has('demon-second-shore') ? 1.2 : 1;
  const fullNoform = features.has('demon-one-furnace') ? 1 : 0.8;
  const variants: AbilityVariantConfig[] = [];
  const contract = selfBuff(buff(
    'sect.wuxiang.demon.contract',
    '魔契',
    2,
    [],
    { description: '第一门魔相神通所立之契；下一门渡厄式将其消费。' },
  ));
  const consumeContract: EffectConfig = {
    type: 'consume_status_trigger',
    params: {
      match: { id: 'sect.wuxiang.demon.contract' },
      displayName: '魔契',
      consume: 'all',
      effects: [],
      target: 'caster',
    },
  };
  const add = (args: {
    buddha: { cost: number; effects: EffectConfig[]; target?: AbilityVariantConfig['targetPolicy']; intents?: AbilityVariantConfig['selectionProfile'] };
    demonName: string;
    demonCost: number;
    base: EffectConfig[];
    entry: EffectConfig[];
    finish: EffectConfig[];
    noformName: string;
    noformCost: number;
    noform: EffectConfig[];
  }) => {
    const firstId = `demon.entry.${id}`;
    const secondId = `demon.finish.${id}`;
    const noformId = `demon.formless.${id}`;
    demonVariantIds.push(firstId, secondId, noformId);
    variants.push(
      {
        id: noformId, name: args.noformName, priority: 300,
        conditions: [modeCondition('formless')], costs: hpCost(args.noformCost),
        effects: [...args.noform, advanceMode],
      },
      {
        id: secondId, name: args.demonName, priority: 220,
        conditions: [modeCondition('demon', 2)], costs: hpCost(args.demonCost),
        effects: [
          ...args.base,
          ...args.finish,
          consumeContract,
          ...(features.has('demon-look-back')
            ? [healMaxHp(0.05)].map((effect) => ({
                ...effect,
                conditions: [{ type: 'hp_below', params: { scope: 'caster', value: 0.2 } }],
              }) as EffectConfig)
            : []),
          ...(features.has('demon-leave-boat')
            ? [selfBuff(buff(DEMON_LEAVE_BOAT_BUFF, '渡后留舟', -1, []))]
            : []),
          advanceMode,
        ],
      },
      {
        id: firstId, name: args.demonName, priority: 210,
        conditions: [modeCondition('demon', 1)], costs: hpCost(args.demonCost),
        effects: [...args.base, ...args.entry, contract, advanceMode],
      },
      {
        id: `demon.buddha.${id}`, name: WUXIANG_BASE_DEFINITION.abilities.find((ability) => ability.id === id)!.baseName,
        priority: 0, conditions: [], costs: hpCost(args.buddha.cost), targetPolicy: args.buddha.target,
        effects: args.buddha.effects, selectionProfile: args.buddha.intents,
      },
    );
    if (features.has('demon-two-gates')) {
      const second = variants.find((variant) => variant.id === secondId);
      const differentId = `${secondId}.different`;
      if (second) {
        demonVariantIds.push(differentId);
        variants.push({
        ...second,
        id: differentId,
        priority: 230,
        conditions: [
          modeCondition('demon', 2),
          { type: 'ability_mode_ability_differs', params: { scope: 'caster', key: WUXIANG_FORM_MODE } },
        ],
        costs: hpCost(args.demonCost / 2),
        });
      }
    }
  };
  const scaled = (coefficient: number, scale: number, force = false) => physical(coefficient * scale, undefined, force);
  switch (id) {
    case 'flower-heart': {
      const gapBonus = features.has('demon-flower-inward') ? 0.25 : 0.15;
      const gap = targetBuff(buff('sect.wuxiang.demon.heart-gap', '心隙', 2, [{
        id: 'sect.wuxiang.demon.heart-gap.damage', eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: EventPriorityLevel.DAMAGE_REQUEST + 1,
        mapping: { caster: 'event.caster', target: 'owner' }, budget: { maxTriggers: 1, reset: 'buff_lifetime' },
        conditions: [{ type: 'ability_has_exact_tag', params: { tag: techniqueTag } }, { type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } }],
        effects: [{ type: 'percent_damage_modifier', params: { mode: 'increase', value: gapBonus } }],
      }], { type: BuffType.DEBUFF, stackRule: StackRule.STACK_LAYER, maxLayers: 2, tags: [GameplayTags.BUFF.TYPE.DEBUFF] }));
      add({
        buddha: { cost: 0.06, effects: [physical(0.6), gap] }, demonName: '摘心问魔', demonCost: 0.05,
        base: [physical(0.95)], entry: [gap, gap],
        finish: [
          {
            type: 'consume_status_trigger',
            params: {
              match: { id: 'sect.wuxiang.demon.heart-gap' },
              displayName: '心隙',
              consume: 'all',
              effects: [scaled(0.2, finishScale)],
              scaleEffectsByLayer: true,
              target: 'target',
            },
          },
          physical(0.4, [{ type: 'hp_below', params: { scope: 'target', value: 0.5 } }]),
        ],
        noformName: '心魔两忘', noformCost: 0.09,
        noform: [physical(1.45 * fullNoform)],
      });
      break;
    }
    case 'blood-tide': {
      const ratio = features.has('demon-no-return-tide') ? 2.5 : 2;
      const releaseHalf: EffectConfig = { type: 'damage_memory', params: { key: WUXIANG_BLOOD_TIDE_MEMORY, mode: 'release', ratio, releaseAs: 'follow_up', target: 'caster', consume: true, consumeRatio: 0.5 } };
      const releaseAll: EffectConfig = { type: 'damage_memory', params: { key: WUXIANG_BLOOD_TIDE_MEMORY, mode: 'release', ratio, releaseAs: 'follow_up', target: 'caster', consume: true } };
      add({
        buddha: { cost: 0.14, effects: [], target: { team: 'self', scope: 'single' }, intents: { intents: ['buff'] } },
        demonName: '血海倒悬', demonCost: 0.07, base: [physical(0.7)], entry: [releaseHalf], finish: [releaseAll],
        noformName: '血海无涯', noformCost: 0.16, noform: [physical(0.7), releaseAll],
      });
      break;
    }
    case 'three-knocks': {
      const threshold = features.has('demon-third-outside') ? 0.55 : 0.45;
      add({
        buddha: { cost: 0.09, effects: [physical(0.25), physical(0.25), physical(0.25), physical(0.25, [{ type: 'hp_below', params: { scope: 'caster', value: threshold } }])] },
        demonName: '三叩魔关', demonCost: 0.08, base: [physical(0.4), physical(0.4)],
        entry: [scaled(0.45, entryScale)],
        finish: [scaled(0.8, finishScale), physical(0.25, [{ type: 'hp_below', params: { scope: 'caster', value: 0.35 } }], true)],
        noformName: '业门无生', noformCost: 0.13,
        noform: [physical(0.45 * fullNoform), physical(0.45 * fullNoform), physical(0.8 * fullNoform, undefined, true)],
      });
      break;
    }
    case 'observe-calamity': {
      const defer = features.has('demon-slow-fire') ? 0.5 : 0.4;
      const deferBuff = selfBuff(buff('sect.wuxiang.demon.defer', '承劫', 1, [{
        id: 'sect.wuxiang.demon.defer.damage', eventType: GameplayTags.EVENT.DAMAGE,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: EventPriorityLevel.DAMAGE_APPLY + 1,
        mapping: { caster: 'owner', target: 'owner' }, guard: { skipSecondaryDamageSource: true },
        effects: [{
          type: 'damage_defer',
          params: {
            ratio: defer,
            delayTurns: 2,
            memory: {
              key: DEMON_CALAMITY_DEBT,
              maxStoredValue: { attribute: AttributeType.ATK, coefficient: 1.25 },
            },
          },
        }],
      }]));
      add({
        buddha: { cost: 0.11, effects: [deferBuff], target: { team: 'self', scope: 'single' }, intents: { intents: ['defensive'] } },
        demonName: '开眼见魔', demonCost: 0.06, base: [physical(0.65)], entry: [deferBuff],
        finish: [{
          type: 'damage_memory',
          params: {
            key: DEMON_CALAMITY_DEBT,
            mode: 'release',
            ratio: 0.8 * finishScale,
            releaseAs: 'follow_up',
            target: 'caster',
            consume: false,
          },
        }], noformName: '劫火自明', noformCost: 0.12,
        noform: [
          physical(0.65 * fullNoform),
          {
            type: 'damage_memory',
            params: { key: DEMON_VIRTUAL_DEBT, mode: 'release', ratio: fullNoform, releaseAs: 'follow_up', target: 'caster', consume: true },
          },
          deferBuff,
        ],
      });
      break;
    }
    case 'five-skandhas': {
      const max = features.has('demon-skandhas-fuel') ? 3 : 2;
      add({
        buddha: { cost: 0.07, effects: [{ type: 'status_transfer', params: { operation: 'remove', from: 'caster', status: 'negative', maxCount: 1, effects: [gainWar()] } }], target: { team: 'self', scope: 'single' }, intents: { intents: ['buff'] } },
        demonName: '焚尽五蕴', demonCost: 0.06, base: [physical(0.7)],
        entry: [{ type: 'status_transfer', params: { operation: 'move', from: 'caster', to: 'target', status: 'negative', maxCount: 1 } }],
        finish: [{ type: 'status_transfer', params: { operation: 'remove', from: 'target', status: 'negative', maxCount: max, effects: [scaled(0.3, finishScale)] } }],
        noformName: '蕴空身在', noformCost: 0.1,
        noform: [physical(0.7 * fullNoform), { type: 'status_transfer', params: { operation: 'move', from: 'caster', to: 'target', status: 'negative', maxCount: 1 } }, { type: 'status_transfer', params: { operation: 'remove', from: 'target', status: 'negative', maxCount: max, effects: [physical(0.3 * fullNoform)] } }],
      });
      break;
    }
    case 'reed-crossing': {
      const ratio = features.has('demon-short-reed') ? 0.3 : 0.35;
      const cap = damageCapBuff('sect.wuxiang.demon.blood-boat', '血舟', ratio);
      const low = [physical(0.55), healMaxHp(0.03)];
      add({
        buddha: { cost: 0.1, effects: [cap], target: { team: 'self', scope: 'single' }, intents: { intents: ['defensive'] } },
        demonName: '一苇渡厄', demonCost: 0.06, base: [physical(1)], entry: [directReductionBuff('sect.wuxiang.demon.reed-guard', '渡厄', 0.25 * entryScale)],
        finish: low.map((effect) => ({ ...effect, conditions: [{ type: 'hp_below', params: { scope: 'caster', value: 0.3 } }] } as EffectConfig)),
        noformName: '苦海无舟', noformCost: 0.12,
        noform: [physical(1.5 * fullNoform), selfBuff(buff('sect.wuxiang.demon.formless-control', '无舟', 1, [], { statusTags: [GameplayTags.STATUS.IMMUNE.CONTROL] })), ...low.map((effect) => ({ ...effect, conditions: [{ type: 'hp_below', params: { scope: 'caster', value: 0.3 } }] } as EffectConfig))],
      });
      break;
    }
  }
  if (features.has('demon-blood-oil')) {
    const base = variants.find((variant) => variant.id === `demon.buddha.${id}`);
    const cost = base?.costs?.[0];
    if (base && cost && cost.mode !== 'flat') {
      variants.push({
        ...base,
        id: `demon.buddha.first.${id}`,
        priority: 10,
        conditions: [
          modeCondition('none'),
          { type: 'runtime_counter_compare', params: { scope: 'caster', key: 'sect.wuxiang.demon.oil-round', value: 1, op: 'lt' } },
        ],
        costs: hpCost(cost.ratio + 0.02),
        castEffects: [
          gainWar(),
          { type: 'runtime_counter_modify', params: { key: 'sect.wuxiang.demon.oil-round', operation: 'set', amount: 1, target: 'caster' } },
        ],
      });
    }
  }
  if (features.has('demon-leave-boat')) {
    const base = variants.find((variant) => variant.id === `demon.buddha.${id}`);
    const cost = base?.costs?.[0];
    if (base && cost && cost.mode !== 'flat') {
      variants.push({
        ...base,
        id: `demon.buddha.leave-boat.${id}`,
        priority: 20,
        conditions: [
          modeCondition('none'),
          { type: 'buff_layer_at_least', params: { scope: 'caster', id: DEMON_LEAVE_BOAT_BUFF, value: 1 } },
        ],
        costs: hpCost(cost.ratio / 2),
        effects: [
          ...(base.effects ?? []),
          { type: 'consume_status_trigger', params: { match: { id: DEMON_LEAVE_BOAT_BUFF }, displayName: '渡后留舟', consume: 'all', effects: [], target: 'caster' } },
        ],
      });
    }
  }
  return variants;
}

function transformVariants(pathId: SectPathId, features: WuxiangFeatures): AbilityVariantConfig[] {
  const isMirror = pathId === WUXIANG_MIRROR_PATH_ID;
  const demonReduction = isMirror
    ? features.has('mirror-form-beyond') ? 0.35 : 0.25
    : features.has('demon-no-gap') ? 0 : 0.2;
  const modeBuff = isMirror
    ? selfBuff(buff('sect.wuxiang.mirror.stillness', '止观', 1, [{
        id: 'sect.wuxiang.mirror.stillness.reduce', eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: EventPriorityLevel.DAMAGE_REQUEST + 1,
        mapping: { caster: 'owner', target: 'owner' }, guard: { skipSecondaryDamageSource: true },
        effects: [{ type: 'percent_damage_modifier', params: { mode: 'reduce', value: demonReduction } }],
      }]))
    : selfBuff(buff('sect.wuxiang.demon.enter', '入魔', 1, [{
        id: 'sect.wuxiang.demon.enter.reduce', eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: EventPriorityLevel.DAMAGE_REQUEST + 1,
        mapping: { caster: 'owner', target: 'owner' }, guard: { skipSecondaryDamageSource: true },
        effects: [{ type: 'percent_damage_modifier', params: { mode: 'reduce', value: demonReduction } }],
      }], { statusTags: [GameplayTags.STATUS.IMMUNE.CONTROL] }));
  const demonFormBuff = !isMirror
    ? selfBuff(buff('sect.wuxiang.demon.control', '魔相', 2, [], { statusTags: [GameplayTags.STATUS.IMMUNE.CONTROL] }))
    : undefined;
  return [
    {
      id: `${pathId}.turn.formless`, name: '一念无间', priority: 300,
      conditions: [{ type: 'combat_resource_at_least', params: { scope: 'caster', resourceId: WUXIANG_WAR_INTENT, value: 6 } }],
      costs: hpCost(0.08), targetPolicy: { team: 'self', scope: 'single' }, selectionProfile: { intents: ['buff'] },
      castEffects: [spendWar('all'), { type: 'ability_mode', params: { key: WUXIANG_FORM_MODE, operation: 'set', mode: 'formless', phase: 1, remainingUses: 1, displayName: '无相待发' } }],
    },
    {
      id: `${pathId}.turn.demon`, name: '魔相入身', priority: 200,
      conditions: [
        { type: 'combat_resource_at_least', params: { scope: 'caster', resourceId: WUXIANG_WAR_INTENT, value: 3 } },
        { type: 'combat_resource_below', params: { scope: 'caster', resourceId: WUXIANG_WAR_INTENT, value: 6 } },
      ],
      costs: hpCost(0.04), targetPolicy: { team: 'self', scope: 'single' }, selectionProfile: { intents: ['buff'] },
      castEffects: [spendWar(3), { type: 'ability_mode', params: { key: WUXIANG_FORM_MODE, operation: 'set', mode: 'demon', phase: 1, remainingUses: 2, displayName: isMirror ? '魔相·现报' : '魔相·入魔式' } }, modeBuff, ...(demonFormBuff ? [demonFormBuff] : [])],
    },
  ];
}

function mirrorPassive(features: WuxiangFeatures): SectCompiledAbility {
  const factory = new SectAbilityFactory(WUXIANG_SECT_ID);
  const definition = WUXIANG_BASE_DEFINITION.abilities.find((entry) => entry.id === 'mirror-core' && entry.kind === 'passive')! as Extract<(typeof WUXIANG_BASE_DEFINITION.abilities)[number], { kind: 'passive' }>;
  const markEffects = [addKarma('target'), gainWar(), ...(features.has('mirror-guest-in-mirror') ? [addKarma('target')] : [])];
  const listeners: ListenerConfig[] = [
    ...(features.has('mirror-vow-body') ? [{
      id: 'sect.wuxiang.mirror.vow-round.reset', eventType: GameplayTags.EVENT.ROUND_START,
      scope: GameplayTags.SCOPE.GLOBAL, priority: 2,
      mapping: { caster: 'owner' as const, target: 'owner' as const },
      effects: [{ type: 'runtime_counter_modify' as const, params: { key: 'sect.wuxiang.mirror.vow-round', operation: 'reset' as const, target: 'caster' as const } }],
    }] : []),
    {
      id: 'sect.wuxiang.mirror.hits', eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: 2,
      mapping: { caster: 'owner', target: 'owner' }, guard: { skipSecondaryDamageSource: true },
      conditions: [{ type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } }],
      effects: [{ type: 'runtime_counter_modify', params: { key: 'sect.wuxiang.mirror.hits', operation: 'add', amount: 1, max: 3, target: 'caster' } }],
    },
    {
      id: 'sect.wuxiang.mirror.mark', eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: 1,
      mapping: { caster: 'owner', target: 'owner' }, guard: { skipSecondaryDamageSource: true },
      budget: { maxTriggers: 1, reset: 'source_action' },
      conditions: [{ type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } }, modeCondition('none')],
      effects: markEffects,
    },
    {
      id: 'sect.wuxiang.mirror.reflect', eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: 0,
      mapping: { caster: 'event.caster', target: 'owner' }, guard: { skipSecondaryDamageSource: true },
      conditions: [{ type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } }, modeCondition('none')],
      effects: [
        { type: 'reflect', params: { ratio: 0.05, ratioPerLayer: 0.03, layerBuffId: WUXIANG_KARMA_BUFF, maxHpRatioPerAction: features.has('mirror-fruit-in-time') ? 0.16 : 0.12 } },
        ...(features.has('mirror-full-light') ? [{
          type: 'reflect' as const,
          params: { ratio: 0.05, layerBuffId: WUXIANG_KARMA_BUFF, maxHpRatioPerAction: features.has('mirror-fruit-in-time') ? 0.16 : 0.12 },
          conditions: [{ type: 'buff_layer_at_least' as const, params: { scope: 'target' as const, id: WUXIANG_KARMA_BUFF, value: 3 } }],
        }] : []),
      ],
    },
  ];
  if (features.has('mirror-not-platform')) listeners.push({
    id: 'sect.wuxiang.mirror.full-reduce', eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
    scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: EventPriorityLevel.DAMAGE_REQUEST + 1,
    mapping: { caster: 'owner', target: 'owner' }, guard: { skipSecondaryDamageSource: true },
    conditions: [modeCondition('none'), { type: 'buff_layer_at_least', params: { scope: 'target', id: WUXIANG_KARMA_BUFF, value: 3 } }],
    effects: [{ type: 'percent_damage_modifier', params: { mode: 'reduce', value: 0.1 } }],
  });
  return factory.passive({ definition, pathId: WUXIANG_MIRROR_PATH_ID, listeners });
}

function demonPassive(features: WuxiangFeatures): SectCompiledAbility {
  const factory = new SectAbilityFactory(WUXIANG_SECT_ID);
  const definition = WUXIANG_BASE_DEFINITION.abilities.find((entry) => entry.id === 'demon-core' && entry.kind === 'passive')! as Extract<(typeof WUXIANG_BASE_DEFINITION.abilities)[number], { kind: 'passive' }>;
  const thresholdEffects = (key: string, threshold: number): EffectConfig[] => [
    gainWar(),
    { type: 'runtime_counter_modify', params: { key, operation: 'set', amount: 1, target: 'caster' } },
    ...(features.has('demon-three-shores') ? [{ type: 'shield' as const, params: { value: { targetMaxHpRatio: 0.02 }, target: 'caster' as const } }] : []),
    ...(features.has('demon-blood-empty') && threshold === 0.25
      ? [{ type: 'shield' as const, params: { value: { targetMaxHpRatio: 0.06 }, target: 'caster' as const } }]
      : []),
  ];
  const listeners: ListenerConfig[] = [
    ...(features.has('demon-blood-oil') ? [{
      id: 'sect.wuxiang.demon.oil-round.reset', eventType: GameplayTags.EVENT.ROUND_START,
      scope: GameplayTags.SCOPE.GLOBAL, priority: 2,
      mapping: { caster: 'owner' as const, target: 'owner' as const },
      effects: [{ type: 'runtime_counter_modify' as const, params: { key: 'sect.wuxiang.demon.oil-round', operation: 'reset' as const, target: 'caster' as const } }],
    }] : []),
    {
      id: 'sect.wuxiang.demon.war', eventType: GameplayTags.EVENT.ABILITY_COST_PAID,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER, priority: 0,
      mapping: { caster: 'owner', target: 'owner' },
      conditions: [
        { type: 'ability_has_exact_tag', params: { tag: techniqueTag } },
        modeCondition('none'),
        ...(features.has('demon-leave-boat')
          ? [{ type: 'buff_layer_below' as const, params: { scope: 'caster' as const, id: DEMON_LEAVE_BOAT_BUFF, value: 1 } }]
          : []),
      ],
      effects: [gainWar()],
    },
    ...[0.7, 0.45, 0.25].map((threshold): ListenerConfig => ({
      id: `sect.wuxiang.demon.threshold.${threshold}`,
      eventType: GameplayTags.EVENT.ABILITY_COST_PAID,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: 1,
      mapping: { caster: 'owner', target: 'owner' },
      conditions: [
        { type: 'ability_has_exact_tag', params: { tag: techniqueTag } }, modeCondition('none'),
        { type: 'ability_cost_crossed', params: { value: threshold } },
        { type: 'runtime_counter_compare', params: { scope: 'caster', key: `sect.wuxiang.demon.threshold.${threshold}`, value: 1, op: 'lt' } },
      ],
      effects: thresholdEffects(`sect.wuxiang.demon.threshold.${threshold}`, threshold),
    })),
    {
      id: 'sect.wuxiang.demon.blood-store', eventType: GameplayTags.EVENT.ABILITY_COST_PAID,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER, priority: 2,
      mapping: { caster: 'owner', target: 'owner' },
      conditions: [{ type: 'ability_variant_is', params: { variantId: 'demon.buddha.blood-tide' } }],
      effects: [{ type: 'damage_memory', params: { key: WUXIANG_BLOOD_TIDE_MEMORY, mode: 'record', event: 'ability_cost_paid', target: 'caster', maxStoredValue: { attribute: AttributeType.MAX_HP, coefficient: features.has('demon-bone-tide') ? 0.22 : 0.15 } } }],
    },
    {
      id: 'sect.wuxiang.demon.virtual-debt', eventType: GameplayTags.EVENT.ABILITY_COST_PAID,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER, priority: 2,
      mapping: { caster: 'owner', target: 'owner' },
      conditions: [{ type: 'ability_variant_is', params: { variantId: 'demon.formless.observe-calamity' } }],
      effects: [{ type: 'damage_memory', params: { key: DEMON_VIRTUAL_DEBT, mode: 'record', event: 'ability_cost_paid', target: 'caster' } }],
    },
    {
      id: 'sect.wuxiang.demon.lifesteal', eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER, priority: 0,
      mapping: { caster: 'owner', target: 'owner' },
      guard: { skipSecondaryDamageSource: true },
      conditions: [{ type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } }],
      effects: [{ type: 'lifesteal', params: { ratio: 0.25, maxHpRatioPerAction: features.has('demon-no-gap') ? 0.12 : 0.08, variantIds: demonVariantIds } }],
    },
    {
      id: 'sect.wuxiang.demon.blood-finish-lifesteal', eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER, priority: 1,
      mapping: { caster: 'owner', target: 'owner' },
      guard: { skipSecondaryDamageSource: true },
      conditions: [{ type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } }],
      effects: [{
        type: 'lifesteal',
        params: {
          ratio: 0.15,
          maxHpRatioPerAction: features.has('demon-no-gap') ? 0.12 : 0.08,
          variantIds: ['demon.finish.blood-tide', 'demon.finish.blood-tide.different'],
        },
      }],
    },
    ...(features.has('demon-body-breaks') ? [{
      id: 'sect.wuxiang.demon.body-breaks', eventType: GameplayTags.EVENT.ABILITY_COST_PAID,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER, priority: 3,
      mapping: { caster: 'owner' as const, target: 'owner' as const },
      conditions: [modeCondition('none'), { type: 'hp_below' as const, params: { scope: 'caster' as const, value: 0.3 } }],
      effects: [selfBuff(buff('sect.wuxiang.demon.body-breaks', '身坏心明', 1, [], {
        modifiers: [{ attrType: AttributeType.CONTROL_RESISTANCE, type: ModifierType.FIXED, value: 0.3 }],
      }))],
    }] : []),
  ];
  return factory.passive({
    definition,
    pathId: WUXIANG_DEMON_PATH_ID,
    listeners,
  });
}

export function compileWuxiangBase(
  _context: SectProjectionContext,
  builder: SectBuildBuilder,
): void {
  const empty = new Set<string>();
  for (const id of WUXIANG_TECHNIQUE_IDS) {
    builder.setAbility(id, makeAbility(id, undefined, mirrorVariants(id, empty), { team: 'enemy', scope: 'single' }));
  }
  builder.setAbility('turn-form', makeAbility('turn-form', undefined, transformVariants(WUXIANG_MIRROR_PATH_ID, empty), { team: 'self', scope: 'single' }));
  builder.setResource({ ...WUXIANG_BASE_DEFINITION.combatResource, initial: 0 });
}

export function compileWuxiangPath(
  builder: SectBuildBuilder,
  pathId: SectPathId,
  features: WuxiangFeatures,
): void {
  demonVariantIds.length = 0;
  const isMirror = pathId === WUXIANG_MIRROR_PATH_ID;
  for (const id of WUXIANG_TECHNIQUE_IDS) {
    builder.setAbility(
      id,
      makeAbility(
        id,
        pathId,
        isMirror ? mirrorVariants(id, features) : demonVariants(id, features),
        { team: 'enemy', scope: 'single' },
      ),
    );
  }
  builder.setAbility('turn-form', makeAbility('turn-form', pathId, transformVariants(pathId, features), { team: 'self', scope: 'single' }));
  builder.setAbility(isMirror ? 'mirror-core' : 'demon-core', isMirror ? mirrorPassive(features) : demonPassive(features));
}
