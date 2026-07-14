import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import type { AbilityConfig, EffectConfig } from '@shared/engine/battle-v5/core/configs';
import { EventPriorityLevel } from '@shared/engine/battle-v5/core/events';
import { AbilityType, AttributeType, BuffType, DamageSource, DamageType, ModifierType } from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { REALM_ORDER, type RealmType } from '@shared/types/constants';
import {
  HEAVY_SWORD_PATH_ID,
  LINGXIAO_ABILITY_BY_ID,
  LINGXIAO_SECT,
  LINGXIAO_SECT_ID,
  SWIFT_SWORD_PATH_ID,
} from './lingxiao';
import { projectSectMethodModifiers } from './methodModifiers';
import { isAbilityUnlocked } from './progression';
import type {
  CultivatorSectPathState,
  CultivatorSectState,
  ResolvedSectAbility,
  SectAbilityId,
  SectAbilityRole,
  SectCombatProjection,
} from './types';

export const LINGXIAO_SWORD_MOMENTUM = 'sect.lingxiao.sword-momentum';
export const LINGXIAO_HEAVY_POSTURE = 'sect.lingxiao.heavy-posture';
export const LINGXIAO_SWORD_MARK_BUFF = 'sect.lingxiao.sword-mark';
export const LINGXIAO_ARMOR_REND_BUFF = 'sect.lingxiao.armor-rend';
export const LINGXIAO_RETURNING_SWALLOW_BUFF = 'sect.lingxiao.returning-swallow';
export const LINGXIAO_HEAVY_GUARD_BUFF = 'sect.lingxiao.heavy-guard';
export const LINGXIAO_SHADOW_STEP_BUFF = 'sect.lingxiao.shadow-step';

const SWIFT_RETAINED_FORCE = 'sect.lingxiao.swift.retained-force';
const SWIFT_GUARDED_EDGE = 'sect.lingxiao.swift.guarded-edge';
const SWIFT_IDLE_ACTIONS = 'sect.lingxiao.swift.idle-actions';
const SWIFT_FINISHER_ACTION = 'sect.lingxiao.swift.finisher-action';
const SWIFT_LINKED_CITY_ROUND = 'sect.lingxiao.swift.linked-city-round';
const SWIFT_ENDLESS_COOLDOWN = 'sect.lingxiao.swift.endless-cooldown';
const SWIFT_GAPLESS = 'sect.lingxiao.swift.gapless';
const HEAVY_RETAINED_FRAME_ACTION = 'sect.lingxiao.heavy.retained-frame-action';
const HEAVY_UNMOVED_GUARD = 'sect.lingxiao.heavy.unmoved-guard';
const HEAVY_IDLE_ACTIONS = 'sect.lingxiao.heavy.idle-actions';
const HEAVY_FINISHER_ACTION = 'sect.lingxiao.heavy.finisher-action';
const HEAVY_AFTERSHOCK_ROUND = 'sect.lingxiao.heavy.aftershock-round';
const HEAVY_LINKED_MOUNTAINS = 'sect.lingxiao.heavy.linked-mountains';
const HEAVY_ECHO_COOLDOWN = 'sect.lingxiao.heavy.echo-cooldown';
const DAMAGE_MODIFIER_PRIORITY = EventPriorityLevel.DAMAGE_REQUEST + 1;

interface BuiltAbility {
  config: AbilityConfig;
  detailRows: string[];
  notes: string[];
}

function damage(coefficient: number, conditions?: EffectConfig['conditions'], bypassDefense = false): EffectConfig {
  return {
    type: 'damage',
    params: { value: { attribute: AttributeType.ATK, coefficient }, damageType: DamageType.PHYSICAL, bypassDefense },
    conditions,
  };
}

function healMaxHp(ratio: number, recipient: 'caster' | 'target' = 'target'): EffectConfig {
  return { type: 'heal', params: { value: { targetMaxHpRatio: ratio }, target: 'hp', recipient } };
}

function shield(
  coefficient: number,
  conditions?: EffectConfig['conditions'],
  target: 'caster' | 'target' = 'target',
): EffectConfig {
  return { type: 'shield', params: { value: { attribute: AttributeType.ATK, coefficient }, target }, conditions };
}

function resource(resourceId: string, amount: number, conditions?: EffectConfig['conditions']): EffectConfig {
  return {
    type: 'combat_resource_modify',
    params: { resourceId, operation: amount >= 0 ? 'add' : 'subtract', amount: Math.abs(amount) },
    conditions,
  };
}

function consumeResource(resourceId: string): EffectConfig {
  return { type: 'combat_resource_modify', params: { resourceId, operation: 'consume_all' } };
}

function counter(
  key: string,
  operation: 'add' | 'subtract' | 'set' | 'reset',
  options: {
    amount?: number;
    amountFromEvent?: 'requested' | 'applied' | 'overflow';
    max?: number;
    effects?: EffectConfig[];
    scaleEffectsByAmount?: boolean;
    conditions?: EffectConfig['conditions'];
  } = {},
): EffectConfig {
  return {
    type: 'runtime_counter_modify',
    params: {
      key,
      operation,
      amount: options.amount,
      amountFromEvent: options.amountFromEvent,
      max: options.max,
      effects: options.effects,
      scaleEffectsByAmount: options.scaleEffectsByAmount,
    },
    conditions: options.conditions,
  };
}

function counterCondition(key: string, op: 'gt' | 'gte' | 'lt' | 'lte', value: number) {
  return { type: 'runtime_counter_compare' as const, params: { key, op, value, scope: 'caster' as const } };
}

function resourceChangeCondition(resourceId: string, eventField: 'requested' | 'applied' | 'overflow', value: number) {
  return {
    type: 'combat_resource_change' as const,
    params: { resourceId, operation: 'add' as const, eventField, op: 'gte' as const, value },
  };
}

const DIRECT_DAMAGE_CONDITION = {
  type: 'damage_source_is' as const,
  params: { damageSource: DamageSource.DIRECT },
};

function swordMark(): EffectConfig {
  return {
    type: 'apply_buff',
    params: {
      target: 'target',
      buffConfig: {
        id: LINGXIAO_SWORD_MARK_BUFF,
        name: '剑痕',
        description: '快剑留下的剑痕，可被收束招式利用。',
        type: BuffType.DEBUFF,
        duration: 2,
        stackRule: StackRule.STACK_LAYER,
        maxLayers: 3,
        tags: [GameplayTags.BUFF.TYPE.DEBUFF, GameplayTags.BUFF.SECT.namespace(LINGXIAO_SECT_ID, 'SwordMark')],
        statusTags: [GameplayTags.STATUS.SECT.state(LINGXIAO_SECT_ID, 'SwordMarked')],
      },
    },
  };
}

function armorRend(): EffectConfig {
  return {
    type: 'apply_buff',
    params: {
      target: 'target',
      buffConfig: {
        id: LINGXIAO_ARMOR_REND_BUFF,
        name: '裂甲',
        description: '重剑震裂护体气机，可被破岳式利用。',
        type: BuffType.DEBUFF,
        duration: 2,
        stackRule: StackRule.STACK_LAYER,
        maxLayers: 3,
        tags: [GameplayTags.BUFF.TYPE.DEBUFF, GameplayTags.BUFF.SECT.namespace(LINGXIAO_SECT_ID, 'ArmorRend')],
      },
    },
  };
}

function roleTag(role: SectAbilityRole): string {
  switch (role) {
    case 'generator': return GameplayTags.ABILITY.SECT.GENERATOR;
    case 'combo': return GameplayTags.ABILITY.SECT.COMBO;
    case 'finisher': return GameplayTags.ABILITY.SECT.FINISHER;
    default: return GameplayTags.ABILITY.SECT.DEFENSIVE;
  }
}

function active(args: {
  id: string;
  name: string;
  mpCost: number;
  cooldown: number;
  role: SectAbilityRole;
  effects: EffectConfig[];
  pathId?: string;
  castConditions?: AbilityConfig['castConditions'];
  targetTeam?: 'enemy' | 'self';
  heal?: boolean;
  extraTags?: string[];
}): AbilityConfig {
  const effectTree = [...args.effects];
  for (let index = 0; index < effectTree.length; index += 1) {
    const effect = effectTree[index];
    if ('effects' in effect.params && Array.isArray(effect.params.effects)) {
      effectTree.push(...effect.params.effects);
    }
    if (effect.type === 'apply_buff') {
      effectTree.push(...(effect.params.buffConfig.listeners?.flatMap((listener) => listener.effects) ?? []));
    }
  }
  const hasDamage = effectTree.some((effect) => effect.type === 'damage');
  const hasHeal = args.heal || effectTree.some((effect) => effect.type === 'heal');
  return {
    slug: `sect.${LINGXIAO_SECT_ID}.${args.id}`,
    name: args.name,
    type: AbilityType.ACTIVE_SKILL,
    mpCost: args.mpCost,
    cooldown: args.cooldown,
    tags: [
      ...(hasDamage ? [GameplayTags.ABILITY.FUNCTION.DAMAGE, GameplayTags.ABILITY.CHANNEL.PHYSICAL] : []),
      ...(hasHeal ? [GameplayTags.ABILITY.FUNCTION.HEAL] : []),
      GameplayTags.ABILITY.KIND.SECT,
      GameplayTags.ABILITY.SECT.namespace(LINGXIAO_SECT_ID),
      ...(args.pathId ? [GameplayTags.ABILITY.SECT.path(LINGXIAO_SECT_ID, args.pathId)] : []),
      GameplayTags.ABILITY.SECT.ability(LINGXIAO_SECT_ID, args.id),
      roleTag(args.role),
      ...(args.extraTags ?? []),
      GameplayTags.ABILITY.TARGET.SINGLE,
    ],
    targetPolicy: { team: args.targetTeam ?? 'enemy', scope: 'single' },
    selectionProfile: { intents: args.role === 'utility' ? ['heal_hp', 'defensive'] : args.role === 'defensive' ? ['defensive'] : ['damage'] },
    castConditions: args.castConditions,
    effects: args.effects,
  };
}

function activePath(sect: CultivatorSectState): CultivatorSectPathState | undefined {
  return sect.paths.find((path) => path.pathId === sect.activePathId);
}

function activeNodes(pathState: CultivatorSectPathState | undefined): Set<string> {
  if (!pathState) return new Set();
  return new Set(pathState.meridianLoadouts.find((loadout) => loadout.slot === pathState.activeMeridianSlot)?.nodeIds ?? []);
}

function manaCost(realm: RealmType, weight: number): number {
  return Math.round((8 + 4 * REALM_ORDER[realm]) * weight);
}

function baseAbilities(sect: CultivatorSectState, realm: RealmType): Record<string, BuiltAbility> {
  const resourceId = LINGXIAO_SWORD_MOMENTUM;
  return {
    'plain-sword': {
      config: active({ id: 'plain-sword', name: '平剑式', mpCost: 0, cooldown: 0, role: 'generator', effects: [damage(0.8), resource(resourceId, 1)] }),
      detailRows: ['伤害：1段 × 0.80物攻', '剑势：获得1点'], notes: [],
    },
    'guiding-sword': {
      config: active({ id: 'guiding-sword', name: '引剑式', mpCost: manaCost(realm, 1), cooldown: 0, role: 'generator', effects: [damage(0.85), resource(resourceId, 1)] }),
      detailRows: ['伤害：0.85物攻', '剑势：获得1点'], notes: [],
    },
    'linked-edge': {
      config: active({ id: 'linked-edge', name: '连锋式', mpCost: manaCost(realm, 1.5), cooldown: 2, role: 'combo', effects: [damage(0.42), damage(0.42), damage(0.42), resource(resourceId, 2), swordMark()] }),
      detailRows: ['伤害：3段 × 0.42物攻', '剑势：获得2点', '剑痕：施加1层'], notes: [],
    },
    'turning-body': {
      config: active({ id: 'turning-body', name: '回身式', mpCost: manaCost(realm, 1.25), cooldown: 3, role: 'defensive', effects: [damage(0.65)] }),
      detailRows: ['伤害：0.65物攻'], notes: [],
    },
    'breaking-edge': {
      config: active({ id: 'breaking-edge', name: '破锋式', mpCost: manaCost(realm, 1.75), cooldown: 2, role: 'finisher', castConditions: [{ type: 'combat_resource_at_least', params: { resourceId, value: 3, scope: 'caster' } }], effects: [damage(1), consumeResource(resourceId)] }),
      detailRows: ['伤害：1.00物攻', '释放：至少3点剑势', '释放后：消耗全部剑势'], notes: [],
    },
    'sword-aegis': {
      config: active({ id: 'sword-aegis', name: '剑罡护体', mpCost: manaCost(realm, 1.5), cooldown: 3, role: 'defensive', targetTeam: 'self', effects: [shield(0.6)] }),
      detailRows: ['护盾：0.60物攻'], notes: [],
    },
    'shadow-step': {
      config: active({ id: 'shadow-step', name: '踏影', mpCost: manaCost(realm, 1), cooldown: 2, role: 'generator', effects: [damage(0.55), { type: 'apply_buff', params: { target: 'caster', buffConfig: { id: LINGXIAO_SHADOW_STEP_BUFF, name: '踏影', type: BuffType.BUFF, duration: 2, stackRule: StackRule.REFRESH_DURATION, tags: [GameplayTags.BUFF.TYPE.BUFF], modifiers: [{ attrType: AttributeType.SPEED, type: ModifierType.ADD, value: 0.1 }] } } }] }),
      detailRows: ['伤害：0.55物攻', '身法：提高10%，持续2回合'], notes: [],
    },
    'sect-ultimate': {
      config: active({ id: 'sect-ultimate', name: '凌霄绝式', mpCost: manaCost(realm, 2.5), cooldown: 4, role: 'finisher', effects: [damage(1.8)] }),
      detailRows: ['伤害：1.80物攻'], notes: [],
    },
    'nurturing-sword': {
      config: active({ id: 'nurturing-sword', name: '养剑式', mpCost: manaCost(realm, 1.5), cooldown: 4, role: 'utility', targetTeam: 'self', heal: true, effects: [healMaxHp(0.08), shield(0.35)] }),
      detailRows: ['恢复：8%最大气血', '护盾：0.35物攻'], notes: [],
    },
  };
}

function buildSwift(sect: CultivatorSectState, realm: RealmType, path: CultivatorSectPathState, nodes: Set<string>): Record<string, BuiltAbility> {
  const built = baseAbilities(sect, realm);
  const scale = 1 + path.level * 0.0008;
  const id = LINGXIAO_SWORD_MOMENTUM;
  const linkedHits = nodes.has('swift-split-light') ? 5 : 3;
  const linkedCoefficient = nodes.has('swift-split-light') ? 0.27 : 0.42;
  const linkedCity = nodes.has('swift-linked-city')
    ? [counter(SWIFT_LINKED_CITY_ROUND, 'add', {
        max: 1,
        effects: [{ type: 'cooldown_modify', params: { cdModifyValue: -1, tags: [GameplayTags.ABILITY.SECT.path(LINGXIAO_SECT_ID, path.pathId)] } }],
      })]
    : [];
  const finisherTail = (): EffectConfig[] => [
    ...(nodes.has('swift-retained-force')
      ? [counter(SWIFT_RETAINED_FORCE, 'reset', {
          scaleEffectsByAmount: true,
          effects: [resource(id, 1)],
        })]
      : []),
    ...(nodes.has('swift-endless-flow')
      ? [counter(SWIFT_ENDLESS_COOLDOWN, 'set', {
          amount: 3,
          conditions: [counterCondition(SWIFT_ENDLESS_COOLDOWN, 'lt', 1)],
          effects: [damage(0.6 * scale), resource(id, 1)],
        })]
      : []),
    ...(nodes.has('swift-gapless')
      ? [
          { type: 'ability_transform' as const, params: { id: 'sect.lingxiao.gapless', triggers: 1, appliesToTags: [GameplayTags.ABILITY.SECT.ability(LINGXIAO_SECT_ID, 'guiding-sword')], freeManaCost: true } },
          counter(SWIFT_GAPLESS, 'set', { amount: 1 }),
        ]
      : []),
    counter(SWIFT_FINISHER_ACTION, 'set', { amount: 1 }),
    counter(SWIFT_IDLE_ACTIONS, 'reset'),
  ];
  built['plain-sword'] = { config: active({ id: 'plain-sword', name: '平剑式', mpCost: 0, cooldown: 0, role: 'generator', pathId: path.pathId, effects: [damage(0.8 * scale), resource(id, 1)] }), detailRows: ['伤害：0.80物攻', '剑势：获得1点'], notes: [] };
  built['guiding-sword'] = { config: active({ id: 'guiding-sword', name: '追风式', mpCost: manaCost(realm, 1), cooldown: 0, role: 'generator', pathId: path.pathId, effects: [damage(0.9 * scale), resource(id, 2)] }), detailRows: ['伤害：0.90物攻', '剑势：获得2点'], notes: [] };
  built['linked-edge'] = {
    config: active({ id: 'linked-edge', name: nodes.has('swift-split-light') ? '分光五叠' : '流光三叠', mpCost: manaCost(realm, 1.5), cooldown: 2, role: 'combo', pathId: path.pathId, effects: [
      ...Array.from({ length: linkedHits }, () => damage(linkedCoefficient * scale)), resource(id, nodes.has('swift-split-light') ? 3 : 2), swordMark(),
      ...(nodes.has('swift-stacking-waves') ? [{ type: 'cooldown_modify' as const, params: { cdModifyValue: -1, tags: [GameplayTags.ABILITY.SECT.GENERATOR], maxCount: 1 } }] : []),
      ...linkedCity,
    ] }),
    detailRows: [`伤害：${linkedHits}段 × ${linkedCoefficient.toFixed(2)}物攻`, `剑势：获得${nodes.has('swift-split-light') ? 3 : 2}点`, '剑痕：施加1层'],
    notes: nodes.has('swift-stacking-waves') ? ['叠浪：完整命中后减少产势技能冷却。'] : [],
  };
  const counterDamage = (nodes.has('swift-returning-swallow') ? 0.825 : 0.55) * scale;
  built['turning-body'] = {
    config: active({ id: 'turning-body', name: '回燕式', mpCost: manaCost(realm, 1.25), cooldown: 3, role: 'defensive', pathId: path.pathId, effects: [damage(0.65 * scale), { type: 'apply_buff', params: { target: 'caster', buffConfig: {
      id: LINGXIAO_RETURNING_SWALLOW_BUFF, name: '回燕姿态', description: '闪避后反击。', type: BuffType.BUFF, duration: 2, stackRule: StackRule.REFRESH_DURATION,
      tags: [GameplayTags.BUFF.TYPE.BUFF, GameplayTags.BUFF.SECT.namespace(LINGXIAO_SECT_ID, 'ReturningSwallow')], modifiers: [{ attrType: AttributeType.EVASION_RATE, type: ModifierType.FIXED, value: 0.08 }],
      listeners: [
        { id: 'sect.lingxiao.returning-swallow-counter', eventType: GameplayTags.EVENT.DODGE, scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: 0, mapping: { caster: 'owner', target: 'event.caster' }, effects: [damage(counterDamage), resource(id, 1), ...(nodes.has('swift-returning-swallow') ? [swordMark()] : [])] },
        ...(nodes.has('swift-unending-wind') ? [
          ...(!nodes.has('swift-returning-swallow') ? [{ id: 'sect.lingxiao.unending-wind.mark', eventType: GameplayTags.EVENT.DODGE, scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: -1, mapping: { caster: 'owner' as const, target: 'event.caster' as const }, budget: { maxTriggers: 1, reset: 'buff_lifetime' as const }, effects: [swordMark()] }] : []),
          { id: 'sect.lingxiao.unending-wind.shield', eventType: GameplayTags.EVENT.DODGE, scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: -1, mapping: { caster: 'owner' as const, target: 'owner' as const }, budget: { maxTriggers: 1, reset: 'buff_lifetime' as const }, effects: [shield(0.4 * scale)] },
        ] : []),
      ],
    } } }] }),
    detailRows: ['伤害：0.65物攻', `反击：${counterDamage.toFixed(2)}物攻`, '剑势：反击获得1点'], notes: [],
  };
  const shadowLine = nodes.has('swift-shadow-line');
  const sheathing = nodes.has('swift-sheathing');
  const base = (shadowLine ? 2.5 : sheathing ? 0.8 : 1) * scale;
  const perMomentum = (sheathing ? 0.2 : 0.25) * scale;
  const breakingEffects: EffectConfig[] = [
    ...(shadowLine ? [{ type: 'next_hit_rule' as const, params: { forceCritical: true, triggers: 1 } }] : []), damage(base),
    ...(!shadowLine ? Array.from({ length: 6 }, (_, index) => damage(perMomentum, [{ type: 'combat_resource_at_least', params: { resourceId: id, value: index + 1, scope: 'caster' } }])) : []),
    { type: 'consume_status_trigger', params: { match: { id: LINGXIAO_SWORD_MARK_BUFF }, consume: 'all', scaleEffectsByLayer: true, effects: [damage((nodes.has('swift-mountain-breaking') ? 0.18 : 0.1) * scale, undefined, nodes.has('swift-mountain-breaking'))] } },
    consumeResource(id),
    ...(sheathing ? [resource(id, 1), shield(0.5, undefined, 'caster')] : []),
    ...finisherTail(),
  ];
  built['breaking-edge'] = { config: active({ id: 'breaking-edge', name: '一线天', mpCost: manaCost(realm, 1.75), cooldown: 2 + (shadowLine ? 1 : 0), role: 'finisher', pathId: path.pathId, castConditions: [{ type: 'combat_resource_at_least', params: { resourceId: id, value: shadowLine ? 6 : 3, scope: 'caster' } }], effects: breakingEffects }), detailRows: [`伤害：${base.toFixed(2)}物攻`, `释放：至少${shadowLine ? 6 : 3}点剑势`, '释放后：消耗全部剑势与剑痕'], notes: [] };
  built['sword-aegis'] = { config: active({ id: 'sword-aegis', name: '剑罡护体', mpCost: manaCost(realm, 1.5), cooldown: 3, role: 'defensive', targetTeam: 'self', pathId: path.pathId, effects: [shield(0.6)] }), detailRows: ['护盾：0.60物攻'], notes: [] };
  built['shadow-step'] = { config: active({ id: 'shadow-step', name: '踏影', mpCost: manaCost(realm, 1), cooldown: 2, role: 'generator', pathId: path.pathId, effects: [damage(0.55 * scale), { type: 'apply_buff', params: { target: 'caster', buffConfig: { id: LINGXIAO_SHADOW_STEP_BUFF, name: '踏影', type: BuffType.BUFF, duration: 2, stackRule: StackRule.REFRESH_DURATION, tags: [GameplayTags.BUFF.TYPE.BUFF], modifiers: [{ attrType: AttributeType.SPEED, type: ModifierType.ADD, value: 0.1 }] } } }] }), detailRows: ['伤害：0.55物攻', '身法：提高10%'], notes: [] };
  built['sect-ultimate'] = path.level >= 70
    ? { config: active({ id: 'sect-ultimate', name: '刹那无痕', mpCost: manaCost(realm, 2.5), cooldown: 4, role: 'finisher', pathId: path.pathId, castConditions: [{ type: 'combat_resource_at_least', params: { resourceId: id, value: 6, scope: 'caster' } }], effects: [...Array.from({ length: 6 }, () => damage(0.4 * scale)), consumeResource(id), resource(id, 1), ...linkedCity, ...finisherTail()] }), detailRows: ['伤害：6段 × 0.40物攻', '释放：6点剑势', '完整命中返还1点剑势'], notes: [] }
    : built['sect-ultimate'];
  built['nurturing-sword'] = { config: active({ id: 'nurturing-sword', name: '剑息养锋', mpCost: manaCost(realm, 1.5), cooldown: 4, role: 'utility', targetTeam: 'self', pathId: path.pathId, heal: true, effects: [healMaxHp(0.08), shield(0.35), resource(id, 2)] }), detailRows: ['恢复：8%最大气血', '护盾：0.35物攻', '剑势：获得2点'], notes: [] };
  return built;
}

function buildHeavy(sect: CultivatorSectState, realm: RealmType, path: CultivatorSectPathState, nodes: Set<string>): Record<string, BuiltAbility> {
  const built = baseAbilities(sect, realm);
  const scale = 1 + path.level * 0.0008;
  const id = LINGXIAO_HEAVY_POSTURE;
  const linkedHits = nodes.has('heavy-triple-ridge') ? 3 : 2;
  const linkedCoefficient = nodes.has('heavy-triple-ridge') ? 0.5 : 0.6;
  const finisherTail = (): EffectConfig[] => [
    ...(nodes.has('heavy-aftershock')
      ? [counter(HEAVY_AFTERSHOCK_ROUND, 'add', {
          max: 1,
          effects: [{ type: 'delayed_effect', params: { id: 'sect.lingxiao.heavy-aftershock', name: '余震', delayTurns: 1, effects: [damage(0.6 * scale)] } }],
        })]
      : []),
    ...(nodes.has('heavy-linked-mountains')
      ? [
          { type: 'ability_transform' as const, params: { id: 'sect.lingxiao.linked-mountains', triggers: 1, appliesToTags: [GameplayTags.ABILITY.SECT.GENERATOR], freeManaCost: true } },
          counter(HEAVY_LINKED_MOUNTAINS, 'set', { amount: 1 }),
        ]
      : []),
    ...(nodes.has('heavy-mountain-river-echo')
      ? [counter(HEAVY_ECHO_COOLDOWN, 'set', {
          amount: 3,
          conditions: [counterCondition(HEAVY_ECHO_COOLDOWN, 'lt', 1)],
          effects: [healMaxHp(0.05, 'caster'), shield(0.8 * scale, undefined, 'caster')],
        })]
      : []),
    counter(HEAVY_FINISHER_ACTION, 'set', { amount: 1 }),
    counter(HEAVY_IDLE_ACTIONS, 'reset'),
  ];
  built['plain-sword'] = { config: active({ id: 'plain-sword', name: '沉锋式', mpCost: 0, cooldown: 0, role: 'generator', pathId: path.pathId, effects: [damage(0.9 * scale), resource(id, 1)] }), detailRows: ['伤害：0.90物攻', '剑架：获得1点'], notes: [] };
  built['guiding-sword'] = { config: active({ id: 'guiding-sword', name: '提岳式', mpCost: manaCost(realm, 1), cooldown: 1, role: 'generator', pathId: path.pathId, effects: [damage(1.15 * scale), resource(id, 2)] }), detailRows: ['伤害：1.15物攻', '剑架：获得2点'], notes: [] };
  built['linked-edge'] = { config: active({ id: 'linked-edge', name: '叠山式', mpCost: manaCost(realm, 1.5), cooldown: 2, role: 'combo', pathId: path.pathId, extraTags: [GameplayTags.ABILITY.SECT.GENERATOR], effects: [...Array.from({ length: linkedHits }, () => damage(linkedCoefficient * scale)), resource(id, nodes.has('heavy-triple-ridge') ? 3 : 2), armorRend(), ...(nodes.has('heavy-shattering-armor') ? [armorRend()] : [])] }), detailRows: [`伤害：${linkedHits}段 × ${linkedCoefficient.toFixed(2)}物攻`, `剑架：获得${nodes.has('heavy-triple-ridge') ? 3 : 2}点`, `裂甲：施加${nodes.has('heavy-shattering-armor') ? 2 : 1}层`], notes: [] };
  const counterDamage = 0.7 * scale * (nodes.has('heavy-crossing-pass') ? 1.5 : 1);
  const guardShield = 0.45 * scale * (nodes.has('heavy-crossing-pass') ? 1.5 : 1);
  built['turning-body'] = { config: active({ id: 'turning-body', name: '横岳式', mpCost: manaCost(realm, 1.25), cooldown: 3, role: 'defensive', pathId: path.pathId, effects: [damage(0.6 * scale), shield(guardShield, undefined, 'caster'), { type: 'apply_buff', params: { target: 'caster', buffConfig: { id: LINGXIAO_HEAVY_GUARD_BUFF, name: '横岳姿态', type: BuffType.BUFF, duration: 2, stackRule: StackRule.REFRESH_DURATION, tags: [GameplayTags.BUFF.TYPE.BUFF], listeners: [{ id: 'sect.lingxiao.heavy-guard-counter', eventType: GameplayTags.EVENT.DAMAGE_TAKEN, scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: 0, mapping: { caster: 'owner', target: 'event.caster' }, budget: { maxTriggers: 1, reset: 'buff_lifetime' }, effects: [damage(counterDamage), resource(id, 1), ...(nodes.has('heavy-crossing-pass') ? [armorRend()] : [])] }] } } }] }), detailRows: ['伤害：0.60物攻', `护盾：${guardShield.toFixed(2)}物攻`, `反击：${counterDamage.toFixed(2)}物攻`], notes: [] };
  const heaven = nodes.has('heavy-heaven-cleaving');
  built['sect-ultimate'] = path.level >= 70
    ? { config: active({ id: 'sect-ultimate', name: '开天断岳', mpCost: manaCost(realm, 2.5), cooldown: 4 + (heaven ? 1 : 0), role: 'finisher', pathId: path.pathId, castConditions: [{ type: 'combat_resource_at_least', params: { resourceId: id, value: 6, scope: 'caster' } }], effects: [damage((heaven ? 3.5 : 3) * scale, undefined, heaven), consumeResource(id), ...finisherTail()] }), detailRows: [`伤害：${heaven ? '3.50' : '3.00'}物攻`, '释放：6点剑架', ...(heaven ? ['特殊：无视防御'] : [])], notes: [] }
    : built['sect-ultimate'];
  const returning = nodes.has('heavy-returning-peak');
  const finisherBase = 1.1 * scale * (returning ? 0.8 : 1);
  const perPosture = 0.3 * scale * (returning ? 0.8 : 1);
  const finisherEffects: EffectConfig[] = [
    damage(finisherBase),
    ...Array.from({ length: 6 }, (_, index) => damage(perPosture, [{ type: 'combat_resource_at_least', params: { resourceId: id, value: index + 1, scope: 'caster' } }])),
    { type: 'consume_status_trigger', params: { match: { id: LINGXIAO_ARMOR_REND_BUFF }, consume: 'all', scaleEffectsByLayer: true, effects: [damage((nodes.has('heavy-rending-mountain') ? 0.18 : 0.1) * scale, undefined, nodes.has('heavy-rending-mountain'))] } },
    consumeResource(id),
    ...(returning ? [resource(id, 2), shield(0.5, undefined, 'caster')] : []),
    ...finisherTail(),
  ];
  built['breaking-edge'] = { config: active({ id: 'breaking-edge', name: '破岳式', mpCost: manaCost(realm, 1.75), cooldown: 2, role: 'finisher', pathId: path.pathId, castConditions: [{ type: 'combat_resource_at_least', params: { resourceId: id, value: 3, scope: 'caster' } }], effects: finisherEffects }), detailRows: [`伤害：${finisherBase.toFixed(2)}物攻 + 每点剑架${perPosture.toFixed(2)}物攻`, '释放：至少3点剑架', '释放后：消耗全部剑架与裂甲'], notes: [] };
  const aegisScale = nodes.has('heavy-immovable-mountain') ? 1.5 : 1;
  built['sword-aegis'] = { config: active({ id: 'sword-aegis', name: '镇山剑罡', mpCost: manaCost(realm, 1.5), cooldown: 3, role: 'defensive', targetTeam: 'self', pathId: path.pathId, extraTags: [GameplayTags.ABILITY.SECT.GENERATOR], effects: [
    shield(0.8 * scale * aegisScale),
    resource(id, 1),
    ...(nodes.has('heavy-immovable-mountain') ? [{ type: 'apply_buff' as const, params: { target: 'caster' as const, buffConfig: {
      id: 'sect.lingxiao.immovable-mountain', name: '不动如山', type: BuffType.BUFF, duration: 2, stackRule: StackRule.REFRESH_DURATION, tags: [GameplayTags.BUFF.TYPE.BUFF],
      listeners: [{ id: 'sect.lingxiao.immovable-mountain.counter', eventType: GameplayTags.EVENT.DAMAGE_TAKEN, scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: 0, mapping: { caster: 'owner' as const, target: 'event.caster' as const }, budget: { maxTriggers: 1, reset: 'buff_lifetime' as const }, effects: [damage(0.6 * scale, [{ type: 'has_shield', params: { scope: 'caster', value: 0 } }])] }],
    } } }] : []),
  ] }), detailRows: [`护盾：${(0.8 * aegisScale).toFixed(2)}物攻`, '剑架：获得1点'], notes: [] };
  built['shadow-step'] = { config: active({ id: 'shadow-step', name: '踏岳式', mpCost: manaCost(realm, 1), cooldown: 2, role: 'generator', pathId: path.pathId, effects: [damage(0.75 * scale), resource(id, 1), { type: 'apply_buff', params: { target: 'caster', buffConfig: { id: 'sect.lingxiao.heavy-defense', name: '踏岳守势', type: BuffType.BUFF, duration: 2, stackRule: StackRule.REFRESH_DURATION, tags: [GameplayTags.BUFF.TYPE.BUFF], modifiers: [{ attrType: AttributeType.DEF, type: ModifierType.ADD, value: 0.1 }] } } }] }), detailRows: ['伤害：0.75物攻', '剑架：获得1点', '防御：提高10%，持续2回合'], notes: [] };
  built['nurturing-sword'] = { config: active({ id: 'nurturing-sword', name: '抱剑养锋', mpCost: manaCost(realm, 1.5), cooldown: 4, role: 'utility', targetTeam: 'self', pathId: path.pathId, heal: true, extraTags: [GameplayTags.ABILITY.SECT.GENERATOR], effects: [healMaxHp(0.08), shield(0.6 * scale), resource(id, 1)] }), detailRows: ['恢复：8%最大气血', '护盾：0.60物攻', '剑架：获得1点'], notes: [] };
  return built;
}

function buildAll(sect: CultivatorSectState, realm: RealmType): { abilities: Record<string, BuiltAbility>; path?: CultivatorSectPathState; nodes: Set<string> } {
  const path = activePath(sect);
  const nodes = activeNodes(path);
  if (path?.pathId === SWIFT_SWORD_PATH_ID) return { abilities: buildSwift(sect, realm, path, nodes), path, nodes };
  if (path?.pathId === HEAVY_SWORD_PATH_ID) return { abilities: buildHeavy(sect, realm, path, nodes), path, nodes };
  return { abilities: baseAbilities(sect, realm), path, nodes };
}

function passive(slug: string, name: string, pathId: string, listeners: NonNullable<AbilityConfig['listeners']>): AbilityConfig {
  return {
    slug,
    name,
    type: AbilityType.PASSIVE_SKILL,
    tags: [GameplayTags.ABILITY.KIND.PASSIVE, GameplayTags.ABILITY.KIND.SECT, GameplayTags.ABILITY.SECT.namespace(LINGXIAO_SECT_ID), GameplayTags.ABILITY.SECT.path(LINGXIAO_SECT_ID, pathId)],
    listeners,
  };
}

function nodePassives(path: CultivatorSectPathState | undefined, nodes: Set<string>): AbilityConfig[] {
  if (!path) return [];
  const values: AbilityConfig[] = [];
  const isSwift = path.pathId === SWIFT_SWORD_PATH_ID;
  const resourceId = isSwift ? LINGXIAO_SWORD_MOMENTUM : LINGXIAO_HEAVY_POSTURE;
  const finisherTag = GameplayTags.ABILITY.SECT.FINISHER;
  const generatorTag = GameplayTags.ABILITY.SECT.GENERATOR;

  const addPassive = (
    id: string,
    name: string,
    listeners: NonNullable<AbilityConfig['listeners']>,
  ) => values.push(passive(`sect.lingxiao.${id}`, name, path.pathId, listeners));

  const probingId = isSwift ? 'swift-probing-edge' : 'heavy-testing-frame';
  if (nodes.has(probingId)) {
    addPassive(probingId, isSwift ? '试锋' : '试架', [{
      id: `sect.lingxiao.${probingId}.counter`, eventType: GameplayTags.EVENT.SKILL_CAST, scope: GameplayTags.SCOPE.OWNER_AS_CASTER, priority: 0,
      mapping: { caster: 'owner', target: 'event.target' },
      effects: [{ type: 'turn_state_counter', conditions: [
        { type: 'ability_has_tag', params: { tag: GameplayTags.ABILITY.SECT.ability(LINGXIAO_SECT_ID, 'plain-sword') } },
        { type: 'is_hit', params: {} },
      ], params: { key: `sect.lingxiao.${probingId}`, event: 'damage_dealt', threshold: 2, resetOnTrigger: true, effects: [resource(resourceId, 1), isSwift ? swordMark() : armorRend()] } }],
    }]);
  }

  const hiddenId = isSwift ? 'swift-hidden-edge' : 'heavy-hidden-weight';
  if (nodes.has(hiddenId)) {
    addPassive(hiddenId, isSwift ? '藏锋' : '藏重', [{
      id: `sect.lingxiao.${hiddenId}.first-hit`,
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: DAMAGE_MODIFIER_PRIORITY,
      mapping: { caster: 'owner', target: 'owner' },
      budget: { maxTriggers: 1, reset: 'battle' },
      conditions: [DIRECT_DAMAGE_CONDITION],
      effects: [
        { type: 'percent_damage_modifier', params: { mode: 'reduce', value: 0.1 } },
        resource(resourceId, 3),
      ],
    }]);
  }

  const borrowedId = isSwift ? 'swift-borrowed-force' : 'heavy-borrowed-weight';
  if (nodes.has(borrowedId)) {
    addPassive(borrowedId, isSwift ? '借势' : '借重', [{
      id: `sect.lingxiao.${borrowedId}.damage`, eventType: GameplayTags.EVENT.DAMAGE_TAKEN, scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: 0,
      mapping: { caster: 'owner', target: 'owner' },
      budget: { maxTriggers: 1, reset: 'round' },
      conditions: [DIRECT_DAMAGE_CONDITION],
      effects: [resource(resourceId, 1)],
    }]);
  }

  if (isSwift && nodes.has('swift-opening')) {
    addPassive('swift-opening', '疾起', [{
      id: 'sect.lingxiao.swift-opening.speed',
      eventType: 'BattleInitEvent',
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: 0,
      mapping: { caster: 'owner', target: 'owner' },
      budget: { maxTriggers: 1, reset: 'battle' },
      effects: [{ type: 'apply_buff', params: { target: 'caster', buffConfig: {
        id: 'sect.lingxiao.swift-opening-speed', name: '疾起', type: BuffType.BUFF, duration: 1, stackRule: StackRule.REFRESH_DURATION,
        tags: [GameplayTags.BUFF.TYPE.BUFF], modifiers: [{ attrType: AttributeType.SPEED, type: ModifierType.ADD, value: 0.08 }],
      } } }],
    }]);
  }

  if (isSwift && nodes.has('swift-retained-force')) {
    addPassive('swift-retained-force', '留势', [{
      id: 'sect.lingxiao.swift-retained-force.overflow',
      eventType: GameplayTags.EVENT.COMBAT_RESOURCE_CHANGE,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: 0,
      mapping: { caster: 'owner', target: 'owner' },
      effects: [counter(SWIFT_RETAINED_FORCE, 'add', {
        amountFromEvent: 'overflow', max: 2,
        conditions: [resourceChangeCondition(resourceId, 'overflow', 1)],
      })],
    }]);
  }

  if (isSwift && nodes.has('swift-guarded-edge')) {
    addPassive('swift-guarded-edge', '守锋', [
      {
        id: 'sect.lingxiao.swift-guarded-edge.skip', eventType: GameplayTags.EVENT.CONTROLLED_SKIP, scope: GameplayTags.SCOPE.OWNER_AS_ACTOR, priority: 0,
        mapping: { caster: 'owner', target: 'owner' }, effects: [counter(SWIFT_GUARDED_EDGE, 'set', { amount: 1 })],
      },
      {
        id: 'sect.lingxiao.swift-guarded-edge.refund', eventType: GameplayTags.EVENT.COMBAT_RESOURCE_CHANGE, scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: 0,
        mapping: { caster: 'owner', target: 'owner' }, effects: [counter(SWIFT_GUARDED_EDGE, 'reset', {
          effects: [resource(resourceId, 1)],
          conditions: [counterCondition(SWIFT_GUARDED_EDGE, 'gte', 1), resourceChangeCondition(resourceId, 'applied', 1), { type: 'ability_has_tag', params: { tag: generatorTag } }],
        })],
      },
    ]);
  }

  if (isSwift && nodes.has('swift-gapless')) {
    addPassive('swift-gapless', '无隙', [{
      id: 'sect.lingxiao.swift-gapless.bonus', eventType: GameplayTags.EVENT.COMBAT_RESOURCE_CHANGE, scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: 0,
      mapping: { caster: 'owner', target: 'owner' }, effects: [counter(SWIFT_GAPLESS, 'reset', {
        effects: [resource(resourceId, 1)],
        conditions: [counterCondition(SWIFT_GAPLESS, 'gte', 1), resourceChangeCondition(resourceId, 'applied', 1), { type: 'ability_has_tag', params: { tag: GameplayTags.ABILITY.SECT.ability(LINGXIAO_SECT_ID, 'guiding-sword') } }],
      })],
    }]);
  }

  if (isSwift && (nodes.has('swift-still-tide') || nodes.has('swift-life-chasing'))) {
    const listeners: NonNullable<AbilityConfig['listeners']> = [];
    if (nodes.has('swift-still-tide')) {
      listeners.push(
        {
          id: 'sect.lingxiao.swift-still-tide.action', eventType: GameplayTags.EVENT.ACTION_POST, scope: GameplayTags.SCOPE.OWNER_AS_ACTOR, priority: 0,
          mapping: { caster: 'owner', target: 'owner' }, effects: [
            counter(SWIFT_IDLE_ACTIONS, 'add', { max: 2, conditions: [counterCondition(SWIFT_FINISHER_ACTION, 'lt', 1)] }),
            counter(SWIFT_IDLE_ACTIONS, 'reset', { conditions: [counterCondition(SWIFT_FINISHER_ACTION, 'gte', 1)] }),
            counter(SWIFT_FINISHER_ACTION, 'reset'),
          ],
        },
        {
          id: 'sect.lingxiao.swift-still-tide.damage', eventType: GameplayTags.EVENT.DAMAGE_REQUEST, scope: GameplayTags.SCOPE.OWNER_AS_CASTER, priority: DAMAGE_MODIFIER_PRIORITY,
          mapping: { caster: 'owner', target: 'event.target' }, effects: [{ type: 'percent_damage_modifier', params: { mode: 'increase', value: 0.2 }, conditions: [{ type: 'ability_has_tag', params: { tag: finisherTag } }, counterCondition(SWIFT_IDLE_ACTIONS, 'gte', 2)] }],
        },
      );
    }
    if (nodes.has('swift-life-chasing')) {
      listeners.push({
        id: 'sect.lingxiao.swift-life-chasing.damage', eventType: GameplayTags.EVENT.DAMAGE_REQUEST, scope: GameplayTags.SCOPE.OWNER_AS_CASTER, priority: DAMAGE_MODIFIER_PRIORITY,
        mapping: { caster: 'owner', target: 'event.target' }, effects: [{ type: 'percent_damage_modifier', params: { mode: 'increase', value: 0.3 }, conditions: [{ type: 'ability_has_tag', params: { tag: finisherTag } }, { type: 'hp_below', params: { value: 0.25, scope: 'target' } }] }],
      });
    }
    addPassive('swift-finisher-modifiers', '快剑收束', listeners);
  }

  if (isSwift && (nodes.has('swift-linked-city') || nodes.has('swift-endless-flow'))) {
    addPassive('swift-round-counters', '剑流轮转', [{
      id: 'sect.lingxiao.swift-round-counters.reset', eventType: GameplayTags.EVENT.ROUND_START, scope: GameplayTags.SCOPE.GLOBAL, priority: 0,
      mapping: { caster: 'owner', target: 'owner' }, effects: [
        ...(nodes.has('swift-linked-city') ? [counter(SWIFT_LINKED_CITY_ROUND, 'reset')] : []),
        ...(nodes.has('swift-endless-flow') ? [counter(SWIFT_ENDLESS_COOLDOWN, 'subtract', { amount: 1 })] : []),
      ],
    }]);
  }

  if (!isSwift && nodes.has('heavy-retained-frame')) {
    addPassive('heavy-retained-frame', '留架', [
      {
        id: 'sect.lingxiao.heavy-retained-frame.reset', eventType: GameplayTags.EVENT.ACTION_PRE, scope: GameplayTags.SCOPE.GLOBAL, priority: 1,
        mapping: { caster: 'owner', target: 'owner' }, effects: [counter(HEAVY_RETAINED_FRAME_ACTION, 'reset')],
      },
      {
        id: 'sect.lingxiao.heavy-retained-frame.overflow', eventType: GameplayTags.EVENT.COMBAT_RESOURCE_CHANGE, scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: 0,
        mapping: { caster: 'owner', target: 'owner' }, effects: [counter(HEAVY_RETAINED_FRAME_ACTION, 'add', {
          amountFromEvent: 'overflow', max: 2, scaleEffectsByAmount: true,
          effects: [shield(0.15 * (1 + path.level * 0.0008))],
          conditions: [resourceChangeCondition(resourceId, 'overflow', 1)],
        })],
      },
    ]);
  }

  if (!isSwift && nodes.has('heavy-unmoved')) {
    addPassive('heavy-unmoved', '不移', [
      {
        id: 'sect.lingxiao.heavy-unmoved.skip', eventType: GameplayTags.EVENT.CONTROLLED_SKIP, scope: GameplayTags.SCOPE.OWNER_AS_ACTOR, priority: 0,
        mapping: { caster: 'owner', target: 'owner' }, effects: [resource(resourceId, 1), counter(HEAVY_UNMOVED_GUARD, 'set', { amount: 1 })],
      },
      {
        id: 'sect.lingxiao.heavy-unmoved.guard', eventType: GameplayTags.EVENT.DAMAGE_REQUEST, scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: DAMAGE_MODIFIER_PRIORITY,
        mapping: { caster: 'owner', target: 'owner' }, effects: [
          { type: 'percent_damage_modifier', params: { mode: 'reduce', value: 0.1 }, conditions: [counterCondition(HEAVY_UNMOVED_GUARD, 'gte', 1), DIRECT_DAMAGE_CONDITION] },
          counter(HEAVY_UNMOVED_GUARD, 'reset', { conditions: [counterCondition(HEAVY_UNMOVED_GUARD, 'gte', 1), DIRECT_DAMAGE_CONDITION] }),
        ],
      },
    ]);
  }

  if (!isSwift && nodes.has('heavy-linked-mountains')) {
    addPassive('heavy-linked-mountains', '连山', [{
      id: 'sect.lingxiao.heavy-linked-mountains.bonus', eventType: GameplayTags.EVENT.COMBAT_RESOURCE_CHANGE, scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: 0,
      mapping: { caster: 'owner', target: 'owner' }, effects: [counter(HEAVY_LINKED_MOUNTAINS, 'reset', {
        effects: [resource(resourceId, 1)],
        conditions: [counterCondition(HEAVY_LINKED_MOUNTAINS, 'gte', 1), resourceChangeCondition(resourceId, 'applied', 1), { type: 'ability_has_tag', params: { tag: generatorTag } }],
      })],
    }]);
  }

  if (!isSwift && (nodes.has('heavy-steady-mountain') || nodes.has('heavy-ending-life'))) {
    const listeners: NonNullable<AbilityConfig['listeners']> = [];
    if (nodes.has('heavy-steady-mountain')) {
      listeners.push(
        {
          id: 'sect.lingxiao.heavy-steady-mountain.action', eventType: GameplayTags.EVENT.ACTION_POST, scope: GameplayTags.SCOPE.OWNER_AS_ACTOR, priority: 0,
          mapping: { caster: 'owner', target: 'owner' }, effects: [
            counter(HEAVY_IDLE_ACTIONS, 'add', { max: 2, conditions: [counterCondition(HEAVY_FINISHER_ACTION, 'lt', 1)] }),
            counter(HEAVY_IDLE_ACTIONS, 'reset', { conditions: [counterCondition(HEAVY_FINISHER_ACTION, 'gte', 1)] }),
            counter(HEAVY_FINISHER_ACTION, 'reset'),
          ],
        },
        {
          id: 'sect.lingxiao.heavy-steady-mountain.guard', eventType: GameplayTags.EVENT.DAMAGE_REQUEST, scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: DAMAGE_MODIFIER_PRIORITY,
          mapping: { caster: 'owner', target: 'owner' }, conditions: [DIRECT_DAMAGE_CONDITION], effects: [
            { type: 'percent_damage_modifier', params: { mode: 'reduce', value: 0.1 }, conditions: [{ type: 'combat_resource_at_least', params: { resourceId, value: 6, scope: 'caster' } }] },
          ],
        },
        {
          id: 'sect.lingxiao.heavy-steady-mountain.finisher', eventType: GameplayTags.EVENT.DAMAGE_REQUEST, scope: GameplayTags.SCOPE.OWNER_AS_CASTER, priority: DAMAGE_MODIFIER_PRIORITY,
          mapping: { caster: 'owner', target: 'event.target' }, effects: [
            { type: 'percent_damage_modifier', params: { mode: 'increase', value: 0.2 }, conditions: [{ type: 'ability_has_tag', params: { tag: finisherTag } }, counterCondition(HEAVY_IDLE_ACTIONS, 'gte', 2)] },
          ],
        },
      );
    }
    if (nodes.has('heavy-ending-life')) {
      listeners.push({
        id: 'sect.lingxiao.heavy-ending-life.damage', eventType: GameplayTags.EVENT.DAMAGE_REQUEST, scope: GameplayTags.SCOPE.OWNER_AS_CASTER, priority: DAMAGE_MODIFIER_PRIORITY,
        mapping: { caster: 'owner', target: 'event.target' }, effects: [{ type: 'percent_damage_modifier', params: { mode: 'increase', value: 0.3 }, conditions: [{ type: 'ability_has_tag', params: { tag: finisherTag } }, { type: 'hp_below', params: { value: 0.25, scope: 'target' } }] }],
      });
    }
    addPassive('heavy-finisher-modifiers', '重剑收束', listeners);
  }

  if (!isSwift && (nodes.has('heavy-aftershock') || nodes.has('heavy-mountain-river-echo'))) {
    addPassive('heavy-round-counters', '山势轮转', [{
      id: 'sect.lingxiao.heavy-round-counters.reset', eventType: GameplayTags.EVENT.ROUND_START, scope: GameplayTags.SCOPE.GLOBAL, priority: 0,
      mapping: { caster: 'owner', target: 'owner' }, effects: [
        ...(nodes.has('heavy-aftershock') ? [counter(HEAVY_AFTERSHOCK_ROUND, 'reset')] : []),
        ...(nodes.has('heavy-mountain-river-echo') ? [counter(HEAVY_ECHO_COOLDOWN, 'subtract', { amount: 1 })] : []),
      ],
    }]);
  }
  return values;
}

export function projectLingxiaoCombat(args: { sect: CultivatorSectState; realm: RealmType }): SectCombatProjection | null {
  const { sect } = args;
  if (sect.status !== 'active' || sect.sectId !== LINGXIAO_SECT_ID) return null;
  const { abilities: built, path, nodes } = buildAll(sect, args.realm);
  const defaultAttack = built['plain-sword'].config;
  const abilities = sect.abilityLoadout
    .filter((id): id is string => id !== null && id !== 'plain-sword' && isAbilityUnlocked(LINGXIAO_SECT, id, sect))
    .map((id) => built[id]?.config)
    .filter((config): config is AbilityConfig => Boolean(config));
  abilities.push(...nodePassives(path, nodes));
  return {
    defaultAttack,
    abilities,
    methodModifiers: projectSectMethodModifiers(sect, LINGXIAO_SECT),
    resources: path?.pathId === HEAVY_SWORD_PATH_ID
      ? [{ id: LINGXIAO_HEAVY_POSTURE, name: '剑架', initial: nodes.has('heavy-opening') ? 2 : 0, max: 6 }]
      : [{
          id: LINGXIAO_SWORD_MOMENTUM,
          name: '剑势',
          initial: nodes.has('swift-opening') ? 2 : 0,
          max: path ? 6 : 3,
          decayOnNoDirectDamage: 1,
          decayOnControlledSkip: nodes.has('swift-guarded-edge') ? 0 : 1,
          pauseDecayWhileShielded: true,
          pauseDecayWhenCounterAtLeast: nodes.has('swift-still-tide')
            ? { key: SWIFT_IDLE_ACTIONS, value: 2 }
            : undefined,
        }],
  };
}

export function resolveLingxiaoAbility(args: { abilityId: SectAbilityId; sect: CultivatorSectState; realm: RealmType }): ResolvedSectAbility {
  const definition = LINGXIAO_ABILITY_BY_ID.get(args.abilityId);
  if (!definition) throw new Error(`未知凌霄神通: ${args.abilityId}`);
  const { abilities } = buildAll(args.sect, args.realm);
  const built = abilities[args.abilityId];
  if (!built) throw new Error(`凌霄神通未能投影: ${args.abilityId}`);
  const minimumRealm = definition.unlockLevel > 0 ? `${definition.unlockLevel}级` : '';
  return {
    id: definition.id,
    name: built.config.name,
    baseName: definition.baseName,
    role: definition.role,
    summary: definition.description,
    unlocked: isAbilityUnlocked(LINGXIAO_SECT, definition.id, args.sect),
    unlockRequirements: [`${LINGXIAO_SECT.methods.find((method) => method.id === definition.methodId)?.name}${minimumRealm}`],
    manaCost: built.config.mpCost ?? 0,
    cooldown: built.config.cooldown ?? 0,
    detailRows: built.detailRows,
    notes: built.notes,
    config: built.config,
  };
}
