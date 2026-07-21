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
import { scaleEffectListNumericStrength } from '@shared/engine/battle-v5/core/effectStrengthScaler';
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
const MIRROR_TRANSITION_GUARD = 'sect.wuxiang.mirror.stillness';
const DEMON_TRANSITION_GUARD = 'sect.wuxiang.demon.enter';
const DEMON_FORM_CONTROL = 'sect.wuxiang.demon.control';
const DEMON_REED_GUARD = 'sect.wuxiang.demon.reed-guard';
const DEMON_BODY_BREAKS_BUFF = 'sect.wuxiang.demon.body-breaks';
const MIRROR_DESCRIPTIONS: Record<WuxiangTechniqueId, {
  buddha: string;
  demon: string;
  formless: string;
}> = {
  'flower-heart': {
    buddha: '以拈花叩心立戒，压低目标下一次直接伤害并留下业痕。',
    demon: '以花落问罪；有业痕时追加现报并封闭一门伤害神通。',
    formless: '设戒、问罪与封招同时结算，随后重置业痕。',
  },
  'blood-tide': {
    buddha: '将下次自身行动前所受直接伤害部分延后结算。',
    demon: '以血海回澜攻击；现报时回复气血并使下一次受击转还部分伤害。',
    formless: '同时获得延伤、回复与伤害转还，不额外造成攻击伤害。',
  },
  'three-knocks': {
    buddha: '三段叩门后留下业门，目标攻击自身时逐扇反伤。',
    demon: '倒叩业门；现报时引爆剩余业门并清空。',
    formless: '立下三扇业门并立即引爆，随后重置业痕。',
  },
  'observe-calamity': {
    buddha: '闭目观劫：首次直接伤害大幅降低，期间直接伤害额外返还。',
    demon: '开眼见劫；按已承受的敌方直接攻击次数追加伤害。',
    formless: '见劫攻击与观劫架势同时结算，随后重置业痕。',
  },
  'five-skandhas': {
    buddha: '化去目标一个可移除增益并转为业痕；无增益时施加伤害衰减。',
    demon: '五蕴还照；现报时转移自身负面状态，无可转移状态时追加伤害。',
    formless: '同时移除目标一个增益与自身一个减益。',
  },
  'reed-crossing': {
    buddha: '下一次直接受击受到单次伤害上限保护，溢出伤害延后结算。',
    demon: '现报时使下一次直接伤害部分转还攻击者。',
    formless: '同时获得单次伤害上限与伤害转还。',
  },
};
const DEMON_DESCRIPTIONS: typeof MIRROR_DESCRIPTIONS = {
  'flower-heart': {
    buddha: '留下心隙，提高下一次宗门直接伤害。',
    demon: '入魔式留下两层心隙；渡厄式消费心隙并按目标已损气血追加伤害。',
    formless: '在同一次行动中留隙、摘心并按目标已损气血收束。',
  },
  'blood-tide': {
    buddha: '将实际支付的气血记入血潮，不造成攻击伤害。',
    demon: '将血潮转为额外物理伤害；入魔式释放一半，渡厄式释放余下部分并强化吸血。',
    formless: '先记入本次气血成本，再将全部血潮一次释放。',
  },
  'three-knocks': {
    buddha: '三段叩门，低气血时强化第三击。',
    demon: '入魔式追加必中第三叩；渡厄式以更强第三叩收束，低气血时该段强制暴击。',
    formless: '在一次行动内完整打出三叩，低气血时末叩强制暴击。',
  },
  'observe-calamity': {
    buddha: '将下一次直接伤害的一部分延后结算。',
    demon: '入魔式令延伤覆盖魔相窗口；渡厄式将已延后的劫债返向目标，债务仍保留。',
    formless: '以本次气血成本生成虚拟劫债并立即返还，同时获得延伤。',
  },
  'five-skandhas': {
    buddha: '移除自身一个可移除减益，成功时额外获得战意。',
    demon: '入魔式转移自身减益；渡厄式焚去目标减益并逐个追加伤害。',
    formless: '在同一次行动中完成减益转移与焚尽。',
  },
  'reed-crossing': {
    buddha: '下一次直接受击受到单次伤害上限保护，溢出伤害延后结算。',
    demon: '入魔式保护下一次魔相行动；渡厄式在低气血时追加伤害并回复气血。',
    formless: '低气血时打出完整收束伤害，获得一次行动的控制免疫并回复气血。',
  },
};
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
    scaleNumericEffectsByLayer:
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
      conditions: [
        { type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } },
        { ...modeCondition('none'), params: { ...modeCondition('none').params, scope: 'target' } },
      ],
      effects: [{ type: 'reflect', params: { ratio: 0.1 } }],
    },
  ]));
}

function redirectBuff(ratio: number): EffectConfig {
  const id = 'sect.wuxiang.mirror.redirect';
  return selfBuff(buff(id, '倒渡', 1, [
    {
      id: 'sect.wuxiang.mirror.redirect.reduce',
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: EventPriorityLevel.DAMAGE_REQUEST + 1,
      mapping: { caster: 'owner', target: 'owner' },
      guard: { skipSecondaryDamageSource: true },
      budget: { maxTriggers: 1, reset: 'buff_lifetime' },
      conditions: [{ type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } }],
      effects: [{ type: 'percent_damage_modifier', params: { mode: 'reduce', value: ratio, scaleByBuffLayer: true } }],
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
      effects: [{ type: 'reflect', params: { ratio: 0, ratioPerLayer: ratio, layerBuffId: id } }],
    },
  ], { stackRule: StackRule.STACK_LAYER, maxLayers: 2 }));
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
    conditions: [{ type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } }],
    effects: [{ type: 'damage_cap', params: { maxHpRatio: ratio, deferOverflowTurns: 1 } }],
  }]));
}

function directReductionBuff(id: string, name: string, reduction: number): EffectConfig {
  return selfBuff(buff(id, name, -1, [{
    id: `${id}.reduce`,
    eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
    scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
    priority: EventPriorityLevel.DAMAGE_REQUEST + 1,
    mapping: { caster: 'owner', target: 'owner' },
    guard: { skipSecondaryDamageSource: true },
    conditions: [{ type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } }],
    effects: [{ type: 'percent_damage_modifier', params: { mode: 'reduce', value: reduction } }],
  }], { dispelPolicy: 'protected' }));
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
      conditions: [
        { type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } },
        { type: 'ability_mode_is', params: { scope: 'target', key: WUXIANG_FORM_MODE, mode: 'none' } },
      ],
      effects: [
        { type: 'percent_damage_modifier', params: { mode: 'reduce', value: reduction } },
        addKarma('target'),
      ],
    }],
    { type: BuffType.DEBUFF, tags: [GameplayTags.BUFF.TYPE.DEBUFF] },
  ));
}

function damageFadingVow(reduction: number): EffectConfig {
  return targetBuff(buff(
    'sect.wuxiang.mirror.skandhas-fade',
    '五蕴衰',
    1,
    [{
      id: 'sect.wuxiang.mirror.skandhas-fade.trigger',
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: EventPriorityLevel.DAMAGE_REQUEST + 1,
      mapping: { caster: 'owner', target: 'event.target' },
      guard: { skipSecondaryDamageSource: true },
      budget: { maxTriggers: 1, reset: 'buff_lifetime' },
      conditions: [{ type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } }],
      effects: [{ type: 'percent_damage_modifier', params: { mode: 'reduce', value: reduction } }],
    }],
    { type: BuffType.DEBUFF, tags: [GameplayTags.BUFF.TYPE.DEBUFF] },
  ));
}

const clearBuff = (id: string): EffectConfig => ({
  type: 'buff_layer_modify',
  params: { match: { id }, operation: 'clear', target: 'caster' },
});

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
      conditions: [
        { type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } },
        modeCondition('none'),
      ],
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
    targetPolicy?: AbilityVariantConfig['targetPolicy'],
  ) => {
    for (const [index, condition] of phaseConditions.entries()) {
      const phase = index + 1;
      const variantId = `mirror.demon.${index + 1}.${id}`;
      variants.push({
        id: variantId,
        name,
        priority: 210 - index,
        conditions: [condition],
        costs: hpCost(cost),
        targetPolicy,
        effects: [
          ...baseEffects,
          ...(features.has('mirror-back-demon') && phase === 1
            ? presentEffects
            : [present(presentEffects)]),
          clearBuff(MIRROR_TRANSITION_GUARD),
          advanceMode,
        ],
        selectionProfile: {
          intents: targetPolicy?.team === 'self'
            ? ['defensive']
            : ['damage'],
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
    selectionProfile: {
      intents: targetPolicy?.team === 'self'
        ? ['defensive']
        : ['damage'],
    },
  });

  switch (id) {
    case 'flower-heart': {
      const enhanced = [physical(0.35 + presentBonus), {
        type: 'ability_lock' as const,
        params: { rounds: 1, tags: [GameplayTags.ABILITY.FUNCTION.DAMAGE], maxCount: 1 },
      }];
      addDemon('花落问罪', 0.05, [physical(0.75)], enhanced);
      addNoform('心花两忘', 0.08, [physical(1.1 + presentBonus), qingHeartVow(features.has('mirror-loud-flower') ? 0.18 : 0.1), enhanced[1]]);
      variants.push({
        id: 'mirror.buddha.flower-heart', name: '拈花叩心', priority: 0, conditions: [], costs: hpCost(0.05),
        effects: [physical(0.6), qingHeartVow(features.has('mirror-loud-flower') ? 0.18 : 0.1), gainWar()],
        selectionProfile: { intents: ['damage'] },
      });
      break;
    }
    case 'blood-tide': {
      const deferRatio = features.has('mirror-welcome-tide') ? 0.4 : 0.3;
      const defer = selfBuff(buff('sect.wuxiang.mirror.tide', '听潮', 1, [{
        id: 'sect.wuxiang.mirror.tide.defer', eventType: GameplayTags.EVENT.DAMAGE,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: EventPriorityLevel.DAMAGE_APPLY + 1,
        mapping: { caster: 'owner', target: 'owner' }, guard: { skipSecondaryDamageSource: true },
        conditions: [{ type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } }],
        effects: [{ type: 'damage_defer', params: { ratio: deferRatio, delayTurns: 2 } }],
      }]));
      addDemon('血海回澜', 0.06, [physical(0.85)], [healMaxHp(0.03), redirectBuff(0.2)]);
      addNoform('海月同潮', 0.1, [defer, healMaxHp(0.03), redirectBuff(0.2)], { team: 'self', scope: 'single' });
      variants.push({ id: 'mirror.buddha.blood-tide', name: '血海听潮', priority: 0, conditions: [], costs: hpCost(0.08), targetPolicy: { team: 'self', scope: 'single' }, effects: [defer, gainWar()], selectionProfile: { intents: ['defensive'] } });
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
      addNoform('门内无人', 0.11, [...karmaDoor(3), { ...detonate[0], params: { ...detonate[0].params, effects: [physical(0.45 + presentBonus)] } }]);
      variants.push({ id: 'mirror.buddha.three-knocks', name: '三叩业门', priority: 0, conditions: [], costs: hpCost(0.07), effects: [physical(0.28), physical(0.28), physical(0.28), ...karmaDoor(doorLayers), gainWar()], selectionProfile: { intents: ['damage'] } });
      break;
    }
    case 'observe-calamity': {
      const guard = mirrorGuardBuff(features.has('mirror-see-guest') ? 0.5 : 0.35);
      const hitBonus = [1, 2, 3].map((hits) => physical(0.22 + presentBonus, [{ type: 'runtime_counter_compare', params: { scope: 'caster', key: 'sect.wuxiang.mirror.hits', value: hits, op: 'gte' } }]));
      addDemon('开眼见劫', 0.06, [physical(0.8)], hitBonus);
      addNoform('劫相俱寂', 0.12, [physical(1.35 + presentBonus), guard], { team: 'enemy', scope: 'single' });
      variants.push({ id: 'mirror.buddha.observe-calamity', name: '闭目观劫', priority: 0, conditions: [], costs: hpCost(0.1), targetPolicy: { team: 'self', scope: 'single' }, effects: [guard, gainWar()], selectionProfile: { intents: ['defensive'] } });
      break;
    }
    case 'five-skandhas': {
      const karmaCount = features.has('mirror-skandhas-mark') ? 2 : 1;
      const convert: EffectConfig = {
        type: 'status_transfer',
        params: {
          operation: 'remove',
          from: 'target',
          status: 'positive',
          maxCount: 1,
          effects: Array.from({ length: karmaCount }, () => addKarma('caster')),
          fallbackEffects: [damageFadingVow(0.08)],
        },
      };
      addDemon('五蕴还照', 0.06, [physical(0.75)], [{ type: 'status_transfer', params: { operation: 'move', from: 'caster', to: 'target', status: 'negative', maxCount: 1, fallbackEffects: [physical(0.3 + presentBonus)] } }]);
      addNoform('五蕴皆空', 0.09, [physical(0.95), { type: 'status_transfer', params: { operation: 'remove', from: 'target', status: 'positive', maxCount: 1 } }, { type: 'status_transfer', params: { operation: 'remove', from: 'caster', status: 'negative', maxCount: 1 } }]);
      variants.push({ id: 'mirror.buddha.five-skandhas', name: '照见五蕴', priority: 0, conditions: [], costs: hpCost(0.06), effects: [physical(0.5), convert, gainWar()], selectionProfile: { intents: ['damage'] } });
      break;
    }
    case 'reed-crossing': {
      const cap = features.has('mirror-carry-karma') ? 0.25 : 0.3;
      addDemon('一苇倒渡', 0.07, [], [redirectBuff(0.5)], { team: 'self', scope: 'single' });
      addNoform('此岸非岸', 0.11, [damageCapBuff('sect.wuxiang.mirror.shore', '彼岸', cap), redirectBuff(0.5)], { team: 'self', scope: 'single' });
      variants.push({ id: 'mirror.buddha.reed-crossing', name: '一苇横江', priority: 0, conditions: [], costs: hpCost(0.08), targetPolicy: { team: 'self', scope: 'single' }, effects: [damageCapBuff('sect.wuxiang.mirror.shore', '彼岸', cap), gainWar()], selectionProfile: { intents: ['defensive'] } });
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
        effects: [...(base.effects ?? []), gainWar()],
        castEffects: [
          ...(base.castEffects ?? []),
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
        effects: [...(base.effects ?? [])],
        castEffects: [{ type: 'consume_status_trigger', params: { match: { id: MIRROR_RETURN_THOUGHT_BUFF }, displayName: '来去一念', consume: 'all', effects: [], target: 'caster' } }],
      });
    }
  }
  for (const variant of variants) {
    const descriptions = MIRROR_DESCRIPTIONS[id];
    variant.description ??= variant.id.includes('.formless.')
      ? descriptions.formless
      : variant.id.includes('.demon.')
        ? descriptions.demon
        : descriptions.buddha;
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
  const scaleClause = (effects: EffectConfig[], multiplier: number) =>
    scaleEffectListNumericStrength(effects, multiplier);
  const variants: AbilityVariantConfig[] = [];
  const bodyBreaksSync: EffectConfig[] = features.has('demon-body-breaks')
    ? [
        clearBuff(DEMON_BODY_BREAKS_BUFF),
        {
          ...selfBuff(buff(DEMON_BODY_BREAKS_BUFF, '身坏心明', -1, [], {
            dispelPolicy: 'protected',
            modifiers: [{
              attrType: AttributeType.CONTROL_RESISTANCE,
              type: ModifierType.FIXED,
              value: 0.3,
            }],
          })),
          conditions: [
            modeCondition('none'),
            { type: 'hp_below', params: { scope: 'caster', value: 0.3 } },
          ],
        } as EffectConfig,
      ]
    : [];
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
    variants.push(
      {
        id: noformId, name: args.noformName, priority: 300,
        conditions: [modeCondition('formless')], costs: hpCost(args.noformCost),
        selectionProfile: { intents: ['damage'] },
        effects: [
          ...args.noform,
          ...(features.has('demon-look-back')
            ? [{
                ...healMaxHp(0.05),
                conditions: [{ type: 'hp_below', params: { scope: 'caster', value: 0.2 } }],
              } as EffectConfig]
            : []),
          advanceMode,
          ...bodyBreaksSync,
        ],
      },
      {
        id: secondId, name: args.demonName, priority: 220,
        conditions: [modeCondition('demon', 2)], costs: hpCost(args.demonCost),
        selectionProfile: { intents: ['damage'] },
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
          ...bodyBreaksSync,
        ],
      },
      {
        id: firstId, name: args.demonName, priority: 210,
        conditions: [modeCondition('demon', 1)], costs: hpCost(args.demonCost),
        selectionProfile: { intents: ['damage'] },
        effects: [
          ...args.base,
          ...args.entry,
          contract,
          clearBuff(DEMON_TRANSITION_GUARD),
          advanceMode,
        ],
      },
      {
        id: `demon.buddha.${id}`, name: WUXIANG_BASE_DEFINITION.abilities.find((ability) => ability.id === id)!.baseName,
        priority: 0, conditions: [], costs: hpCost(args.buddha.cost), targetPolicy: args.buddha.target,
        effects: args.buddha.effects,
        selectionProfile: args.buddha.intents ?? (
          args.buddha.effects.some((effect) => effect.type === 'damage')
            ? { intents: ['damage'] }
            : undefined
        ),
      },
    );
    if (features.has('demon-two-gates')) {
      const second = variants.find((variant) => variant.id === secondId);
      const differentId = `${secondId}.different`;
      if (second) {
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
  switch (id) {
    case 'flower-heart': {
      const gapBonus = features.has('demon-flower-inward') ? 0.25 : 0.15;
      const gap = (bonus: number) => targetBuff(buff(
        'sect.wuxiang.demon.heart-gap',
        '心隙',
        2,
        [{
          id: 'sect.wuxiang.demon.heart-gap.damage',
          eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
          scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
          priority: EventPriorityLevel.DAMAGE_REQUEST + 1,
          mapping: { caster: 'event.caster', target: 'owner' },
          budget: { maxTriggers: 1, reset: 'buff_lifetime' },
          conditions: [
            { type: 'ability_has_exact_tag', params: { tag: techniqueTag } },
            { type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } },
          ],
          effects: [{ type: 'percent_damage_modifier', params: { mode: 'increase', value: bonus } }],
        }],
        {
          type: BuffType.DEBUFF,
          stackRule: StackRule.STACK_LAYER,
          maxLayers: 2,
          tags: [GameplayTags.BUFF.TYPE.DEBUFF],
        },
      ));
      const entryFlower = [gap(gapBonus), gap(gapBonus)];
      const finishFlower: EffectConfig[] = [
        {
          type: 'consume_status_trigger',
          params: {
            match: { id: 'sect.wuxiang.demon.heart-gap' },
            displayName: '心隙',
            consume: 'all',
            effects: [physical(0.2)],
            scaleEffectsByLayer: true,
            target: 'target',
          },
        },
        {
          type: 'damage',
          params: {
            value: { attribute: AttributeType.ATK, coefficient: 0 },
            damageType: DamageType.PHYSICAL,
            damageSource: DamageSource.DIRECT,
            dynamicScalars: [{
              source: 'target_missing_hp_ratio',
              attribute: AttributeType.ATK,
              coefficientCap: 0.4,
              timing: 'cast',
            }],
          },
        },
      ];
      add({
        buddha: { cost: 0.06, effects: [physical(0.6), gap(gapBonus)] }, demonName: '摘心问魔', demonCost: 0.05,
        base: [physical(0.95)], entry: scaleClause(entryFlower, entryScale),
        finish: scaleClause(finishFlower, finishScale),
        noformName: '心魔两忘', noformCost: 0.09,
        noform: [
          ...scaleClause([physical(0.95)], fullNoform),
          ...scaleClause(entryFlower, entryScale * fullNoform),
          ...scaleClause(finishFlower, finishScale * fullNoform),
        ],
      });
      break;
    }
    case 'blood-tide': {
      const ratio = features.has('demon-no-return-tide') ? 2.5 : 2;
      const release = (consumeRatio: number, maxCoefficient: number): EffectConfig => ({
        type: 'damage_memory',
        params: {
          key: WUXIANG_BLOOD_TIDE_MEMORY,
          mode: 'release',
          ratio,
          releaseAs: 'follow_up',
          target: 'caster',
          consume: true,
          consumeRatio,
          maxReleaseValue: {
            attribute: AttributeType.ATK,
            coefficient: maxCoefficient,
          },
        },
      });
      add({
        buddha: { cost: 0.14, effects: [], target: { team: 'self', scope: 'single' }, intents: { intents: ['buff'] } },
        demonName: '血海倒悬', demonCost: 0.07, base: [physical(0.7)],
        entry: scaleClause([release(0.5, 1.1)], entryScale),
        finish: scaleClause([release(1, 1.1)], finishScale),
        noformName: '血海无涯', noformCost: 0.16,
        noform: [
          ...scaleClause([physical(0.7)], fullNoform),
          ...scaleClause(
            scaleClause([release(1, 1.4)], (entryScale + finishScale) / 2),
            fullNoform,
          ),
        ],
      });
      break;
    }
    case 'three-knocks': {
      const threshold = features.has('demon-third-outside') ? 0.55 : 0.45;
      const finishKnock: EffectConfig = {
        ...physical(0.8),
        params: {
          ...(physical(0.8) as Extract<EffectConfig, { type: 'damage' }>).params,
          forceCriticalConditions: [{ type: 'hp_below', params: { scope: 'caster', value: 0.35, timing: 'cast' } }],
        },
      } as EffectConfig;
      add({
        buddha: { cost: 0.09, effects: [physical(0.25), physical(0.25), physical(0.25), physical(0.25, [{ type: 'hp_below', params: { scope: 'caster', value: threshold, timing: 'cast' } }])] },
        demonName: '三叩魔关', demonCost: 0.08, base: [physical(0.4), physical(0.4)],
        entry: scaleClause([physical(0.45)], entryScale),
        finish: scaleClause([finishKnock], finishScale),
        noformName: '业门无生', noformCost: 0.13,
        noform: [
          ...scaleClause([physical(0.45), physical(0.45)], entryScale * fullNoform),
          ...scaleClause([finishKnock], finishScale * fullNoform),
        ],
      });
      break;
    }
    case 'observe-calamity': {
      const defer = features.has('demon-slow-fire') ? 0.5 : 0.4;
      const deferBuff = (ratio: number) => selfBuff(buff('sect.wuxiang.demon.defer', '承劫', 1, [{
        id: 'sect.wuxiang.demon.defer.damage', eventType: GameplayTags.EVENT.DAMAGE,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: EventPriorityLevel.DAMAGE_APPLY + 1,
        mapping: { caster: 'owner', target: 'owner' }, guard: { skipSecondaryDamageSource: true },
        conditions: [{ type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } }],
        effects: [{
          type: 'damage_defer',
          params: {
            ratio,
            delayTurns: 2,
            memory: {
              key: DEMON_CALAMITY_DEBT,
              maxStoredValue: { attribute: AttributeType.ATK, coefficient: 1.25 },
            },
          },
        }],
      }]));
      add({
        buddha: { cost: 0.11, effects: [deferBuff(defer)], target: { team: 'self', scope: 'single' }, intents: { intents: ['defensive'] } },
        demonName: '开眼见魔', demonCost: 0.06, base: [physical(0.65)], entry: scaleClause([deferBuff(defer)], entryScale),
        finish: scaleClause([{
          type: 'damage_memory',
          params: {
            key: DEMON_CALAMITY_DEBT,
            mode: 'release',
            ratio: 0.8,
            releaseAs: 'follow_up',
            target: 'caster',
            consume: false,
          },
        }], finishScale), noformName: '劫火自明', noformCost: 0.12,
        noform: [
          ...scaleClause([physical(0.65)], fullNoform),
          ...scaleClause([{
            type: 'damage_memory',
            params: { key: DEMON_VIRTUAL_DEBT, mode: 'release', ratio: 1, releaseAs: 'follow_up', target: 'caster', consume: true },
          }], finishScale * fullNoform),
          ...scaleClause([deferBuff(defer)], entryScale * fullNoform),
        ],
      });
      break;
    }
    case 'five-skandhas': {
      const entryMax = features.has('demon-skandhas-fuel') ? 3 : 1;
      const finishMax = features.has('demon-skandhas-fuel') ? 3 : 2;
      const entrySkandhas: EffectConfig[] = [{ type: 'status_transfer', params: { operation: 'move', from: 'caster', to: 'target', status: 'negative', maxCount: entryMax } }];
      const finishSkandhas: EffectConfig[] = [{ type: 'status_transfer', params: { operation: 'remove', from: 'target', status: 'negative', maxCount: finishMax, effects: [physical(0.3)] } }];
      add({
        buddha: { cost: 0.07, effects: [{ type: 'status_transfer', params: { operation: 'remove', from: 'caster', status: 'negative', maxCount: 1, effects: [gainWar()] } }], target: { team: 'self', scope: 'single' }, intents: { intents: ['buff'] } },
        demonName: '焚尽五蕴', demonCost: 0.06, base: [physical(0.7)],
        entry: scaleClause(entrySkandhas, entryScale),
        finish: scaleClause(finishSkandhas, finishScale),
        noformName: '蕴空身在', noformCost: 0.1,
        noform: [
          ...scaleClause([physical(0.7)], fullNoform),
          ...scaleClause(entrySkandhas, entryScale * fullNoform),
          ...scaleClause(finishSkandhas, finishScale * fullNoform),
        ],
      });
      break;
    }
    case 'reed-crossing': {
      const ratio = features.has('demon-short-reed') ? 0.3 : 0.35;
      const cap = damageCapBuff('sect.wuxiang.demon.blood-boat', '血舟', ratio);
      const lowCondition: ConditionConfig[] = [{
        type: 'hp_below',
        params: { scope: 'caster', value: 0.3, timing: 'cast' },
      }];
      const lowFinish = [
        physical(0.55, lowCondition),
        { ...healMaxHp(0.03), conditions: lowCondition } as EffectConfig,
      ];
      add({
        buddha: { cost: 0.1, effects: [cap], target: { team: 'self', scope: 'single' }, intents: { intents: ['defensive'] } },
        demonName: '一苇渡厄', demonCost: 0.06, base: [physical(1)], entry: scaleClause([directReductionBuff(DEMON_REED_GUARD, '渡厄', 0.25)], entryScale),
        finish: scaleClause(lowFinish, finishScale),
        noformName: '苦海无舟', noformCost: 0.12,
        noform: [
          ...scaleClause([physical(1)], fullNoform),
          ...scaleClause([physical(0.5, lowCondition)], finishScale * fullNoform),
          selfBuff(buff('sect.wuxiang.demon.formless-control', '无舟', 1, [], { statusTags: [GameplayTags.STATUS.IMMUNE.CONTROL] })),
          ...scaleClause([{ ...healMaxHp(0.03), conditions: lowCondition } as EffectConfig], finishScale * fullNoform),
        ],
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
        effects: [...(base.effects ?? [])],
        castEffects: [{ type: 'consume_status_trigger', params: { match: { id: DEMON_LEAVE_BOAT_BUFF }, displayName: '渡后留舟', consume: 'all', effects: [], target: 'caster' } }],
      });
    }
  }
  for (const variant of variants) {
    const descriptions = DEMON_DESCRIPTIONS[id];
    variant.description ??= variant.id.includes('.formless.')
      ? descriptions.formless
      : variant.id.includes('.entry.') || variant.id.includes('.finish.')
        ? descriptions.demon
        : descriptions.buddha;
  }
  return variants;
}

function transformVariants(pathId: SectPathId, features: WuxiangFeatures): AbilityVariantConfig[] {
  const isMirror = pathId === WUXIANG_MIRROR_PATH_ID;
  const demonReduction = isMirror
    ? features.has('mirror-form-beyond') ? 0.35 : 0.25
    : features.has('demon-no-gap') ? 0 : 0.2;
  const modeBuff = isMirror
    ? selfBuff(buff(MIRROR_TRANSITION_GUARD, '止观', -1, [{
        id: 'sect.wuxiang.mirror.stillness.reduce', eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: EventPriorityLevel.DAMAGE_REQUEST + 1,
        mapping: { caster: 'owner', target: 'owner' }, guard: { skipSecondaryDamageSource: true },
        effects: [{ type: 'percent_damage_modifier', params: { mode: 'reduce', value: demonReduction } }],
      }], { dispelPolicy: 'protected' }))
    : selfBuff(buff(DEMON_TRANSITION_GUARD, '入魔', -1, [{
        id: 'sect.wuxiang.demon.enter.reduce', eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: EventPriorityLevel.DAMAGE_REQUEST + 1,
        mapping: { caster: 'owner', target: 'owner' }, guard: { skipSecondaryDamageSource: true },
        effects: [{ type: 'percent_damage_modifier', params: { mode: 'reduce', value: demonReduction } }],
      }], { dispelPolicy: 'protected' }));
  const demonFormBuff = !isMirror
    ? selfBuff(buff(DEMON_FORM_CONTROL, '魔相', -1, [], {
        statusTags: [GameplayTags.STATUS.IMMUNE.CONTROL],
        dispelPolicy: 'protected',
      }))
    : undefined;
  return [
    {
      id: `${pathId}.turn.formless`, name: '一念无间', priority: 300,
      description: '消耗全部战意，令下一门宗门神通化为无相式。',
      conditions: [{ type: 'combat_resource_at_least', params: { scope: 'caster', resourceId: WUXIANG_WAR_INTENT, value: 6 } }],
      costs: hpCost(0.08), targetPolicy: { team: 'self', scope: 'single' }, selectionProfile: { intents: ['buff'] },
      castEffects: [
        spendWar('all'),
        { type: 'ability_mode', params: { key: WUXIANG_FORM_MODE, operation: 'set', mode: 'formless', phase: 1, remainingUses: 1, displayName: '无相待发' } },
        ...(!isMirror && features.has('demon-body-breaks')
          ? [clearBuff(DEMON_BODY_BREAKS_BUFF)]
          : []),
      ],
    },
    {
      id: `${pathId}.turn.demon`, name: '魔相入身', priority: 200,
      description: '消耗3点战意，令之后两门成功结算的宗门神通进入魔相。',
      conditions: [
        { type: 'combat_resource_at_least', params: { scope: 'caster', resourceId: WUXIANG_WAR_INTENT, value: 3 } },
        { type: 'combat_resource_below', params: { scope: 'caster', resourceId: WUXIANG_WAR_INTENT, value: 6 } },
      ],
      costs: hpCost(0.04), targetPolicy: { team: 'self', scope: 'single' }, selectionProfile: { intents: ['buff'] },
      castEffects: [
        spendWar(3),
        {
          type: 'ability_mode',
          params: {
            key: WUXIANG_FORM_MODE,
            operation: 'set',
            mode: 'demon',
            phase: 1,
            remainingUses: 2,
            displayName: isMirror ? '魔相·现报' : '魔相·入魔式',
            cleanupBuffIds: isMirror
              ? [MIRROR_TRANSITION_GUARD]
              : [DEMON_TRANSITION_GUARD, DEMON_FORM_CONTROL, DEMON_REED_GUARD],
          },
        },
        modeBuff,
        ...(demonFormBuff ? [demonFormBuff] : []),
        ...(!isMirror && features.has('demon-body-breaks')
          ? [clearBuff(DEMON_BODY_BREAKS_BUFF)]
          : []),
      ],
    },
  ];
}

function mirrorPassive(features: WuxiangFeatures): SectCompiledAbility {
  const factory = new SectAbilityFactory(WUXIANG_SECT_ID);
  const definition = WUXIANG_BASE_DEFINITION.abilities.find((entry) => entry.id === 'mirror-core' && entry.kind === 'passive')! as Extract<(typeof WUXIANG_BASE_DEFINITION.abilities)[number], { kind: 'passive' }>;
  const markEffects = [addKarma('target'), gainWar()];
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
    ...(features.has('mirror-guest-in-mirror') ? [{
      id: 'sect.wuxiang.mirror.guest-round',
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: 1,
      mapping: { caster: 'owner' as const, target: 'owner' as const },
      guard: { skipSecondaryDamageSource: true },
      budget: { maxTriggers: 1, reset: 'round' as const },
      conditions: [
        { type: 'damage_source_is' as const, params: { damageSource: DamageSource.DIRECT } },
        modeCondition('none'),
      ],
      effects: [addKarma('target')],
    }] : []),
    {
      id: 'sect.wuxiang.mirror.reflect', eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: 0,
      mapping: { caster: 'event.caster', target: 'owner' }, guard: { skipSecondaryDamageSource: true },
      conditions: [
        { type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } },
        { ...modeCondition('none'), params: { ...modeCondition('none').params, scope: 'target' } },
      ],
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
  const finishScale = features.has('demon-second-shore') ? 1.2 : 1;
  const demonVariantIds = WUXIANG_TECHNIQUE_IDS.flatMap((abilityId) => [
    `demon.entry.${abilityId}`,
    `demon.finish.${abilityId}`,
    `demon.formless.${abilityId}`,
    ...(features.has('demon-two-gates')
      ? [`demon.finish.${abilityId}.different`]
      : []),
  ]);
  const bodyBreaksSync: EffectConfig[] = features.has('demon-body-breaks')
    ? [
        clearBuff(DEMON_BODY_BREAKS_BUFF),
        {
          ...selfBuff(buff(DEMON_BODY_BREAKS_BUFF, '身坏心明', -1, [], {
            dispelPolicy: 'protected',
            modifiers: [{
              attrType: AttributeType.CONTROL_RESISTANCE,
              type: ModifierType.FIXED,
              value: 0.3,
            }],
          })),
          conditions: [
            modeCondition('none'),
            { type: 'hp_below', params: { scope: 'caster', value: 0.3 } },
          ],
        } as EffectConfig,
      ]
    : [];
  const bodyBreaksListener = (
    id: string,
    eventType: string,
    scope: ListenerConfig['scope'],
  ): ListenerConfig => ({
    id,
    eventType,
    scope,
    priority: 3,
    mapping: { caster: 'owner', target: 'owner' },
    effects: bodyBreaksSync,
  });
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
      conditions: [
        { type: 'ability_has_exact_tag', params: { tag: GameplayTags.ABILITY.SECT.ability(WUXIANG_SECT_ID, 'blood-tide') } },
        modeCondition('none'),
      ],
      effects: [{ type: 'damage_memory', params: { key: WUXIANG_BLOOD_TIDE_MEMORY, mode: 'record', event: 'ability_cost_paid', target: 'caster', maxStoredValue: { attribute: AttributeType.MAX_HP, coefficient: features.has('demon-bone-tide') ? 0.22 : 0.15 } } }],
    },
    {
      id: 'sect.wuxiang.demon.blood-store-formless', eventType: GameplayTags.EVENT.ABILITY_COST_PAID,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER, priority: 2,
      mapping: { caster: 'owner', target: 'owner' },
      conditions: [
        { type: 'ability_variant_is', params: { variantId: 'demon.formless.blood-tide' } },
      ],
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
          ratio: Number((0.4 * finishScale - 0.25).toFixed(6)),
          maxHpRatioPerAction: features.has('demon-no-gap') ? 0.12 : 0.08,
          variantIds: ['demon.finish.blood-tide', 'demon.finish.blood-tide.different'],
        },
      }],
    },
    ...(features.has('demon-body-breaks') ? [
      bodyBreaksListener(
        'sect.wuxiang.demon.body-breaks.hp',
        GameplayTags.EVENT.HP_CHANGED,
        GameplayTags.SCOPE.OWNER_AS_TARGET,
      ),
      bodyBreaksListener(
        'sect.wuxiang.demon.body-breaks.round',
        GameplayTags.EVENT.ROUND_START,
        GameplayTags.SCOPE.GLOBAL,
      ),
    ] : []),
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
