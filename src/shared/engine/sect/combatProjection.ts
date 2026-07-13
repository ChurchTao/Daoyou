import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import type {
  AbilityConfig,
  AbilitySelectionRule,
  EffectConfig,
} from '@shared/engine/battle-v5/core/configs';
import {
  AbilityType,
  AttributeType,
  BuffType,
  DamageType,
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { REALM_ORDER, type RealmType } from '@shared/types/constants';
import { LINGXIAO_METHOD_BY_ID } from './lingxiao';
import { isAbilityUnlocked } from './progression';
import type {
  CultivatorSectState,
  LingxiaoAbilityId,
  SectCombatProjection,
  SectTacticId,
} from './types';

export const LINGXIAO_SWORD_MOMENTUM = 'sect.lingxiao.sword-momentum';
export const LINGXIAO_SWORD_MARK_BUFF = 'sect.lingxiao.sword-mark';

const PHYSICAL_SECT_TAGS = [
  GameplayTags.ABILITY.FUNCTION.DAMAGE,
  GameplayTags.ABILITY.CHANNEL.PHYSICAL,
  GameplayTags.ABILITY.KIND.SECT,
  GameplayTags.ABILITY.SECT.LINGXIAO,
  GameplayTags.ABILITY.TARGET.SINGLE,
];

function damage(coefficient: number, conditions?: EffectConfig['conditions']): EffectConfig {
  return {
    type: 'damage',
    params: { value: { attribute: AttributeType.ATK, coefficient }, damageType: DamageType.PHYSICAL },
    conditions,
  };
}

function momentum(amount: number): EffectConfig {
  return {
    type: 'combat_resource_modify',
    params: {
      resourceId: LINGXIAO_SWORD_MOMENTUM,
      operation: amount >= 0 ? 'add' : 'subtract',
      amount: Math.abs(amount),
    },
  };
}

function consumeMomentum(): EffectConfig {
  return {
    type: 'combat_resource_modify',
    params: { resourceId: LINGXIAO_SWORD_MOMENTUM, operation: 'consume_all' },
  };
}

function swordMark(): EffectConfig {
  return {
    type: 'apply_buff',
    params: {
      buffConfig: {
        id: LINGXIAO_SWORD_MARK_BUFF,
        name: '剑痕',
        description: '快剑留下的剑痕，可被收束招式利用。',
        type: BuffType.DEBUFF,
        duration: 2,
        stackRule: StackRule.STACK_LAYER,
        maxLayers: 3,
        tags: [GameplayTags.BUFF.TYPE.DEBUFF, GameplayTags.BUFF.SECT.SWORD_MARK],
        statusTags: [GameplayTags.STATUS.STATE.SWORD_MARKED],
      },
      target: 'target',
    },
  };
}

function tacticRules(tactic: SectTacticId, role: 'generator' | 'combo' | 'finisher' | 'defensive'): AbilitySelectionRule[] {
  const rules: AbilitySelectionRule[] = [];
  if (role === 'finisher') {
    const threshold = tactic === 'aggressive' ? 3 : tactic === 'counter' ? 5 : 6;
    rules.push({
      conditions: [{ type: 'combat_resource_below', params: { resourceId: LINGXIAO_SWORD_MOMENTUM, value: threshold, scope: 'caster' } }],
      scoreDelta: -120,
    });
    rules.push({
      conditions: [{ type: 'hp_below', params: { value: 0.25, scope: 'target' } }],
      scoreDelta: tactic === 'aggressive' ? 180 : 80,
    });
  }
  if (role === 'defensive') {
    rules.push({
      conditions: [{ type: 'hp_below', params: { value: tactic === 'counter' ? 0.7 : 0.4, scope: 'caster' } }],
      scoreDelta: tactic === 'aggressive' ? 10 : 130,
    });
    rules.push({
      conditions: [{ type: 'hp_above', params: { value: tactic === 'counter' ? 0.7 : 0.65, scope: 'caster' } }],
      scoreDelta: -80,
    });
  }
  if (role === 'generator') {
    rules.push({
      conditions: [{ type: 'combat_resource_below', params: { resourceId: LINGXIAO_SWORD_MOMENTUM, value: tactic === 'aggressive' ? 3 : 6, scope: 'caster' } }],
      scoreDelta: 55,
    });
  }
  return rules;
}

function active(args: {
  id: LingxiaoAbilityId;
  name: string;
  mpCost: number;
  cooldown: number;
  effects: EffectConfig[];
  role: 'generator' | 'combo' | 'finisher' | 'defensive';
  tactic: SectTacticId;
  castConditions?: AbilityConfig['castConditions'];
  targetTeam?: 'enemy' | 'self';
  extraTags?: string[];
}): AbilityConfig {
  const roleTag = args.role === 'generator'
    ? GameplayTags.ABILITY.SECT.GENERATOR
    : args.role === 'combo'
      ? GameplayTags.ABILITY.SECT.COMBO
      : args.role === 'finisher'
        ? GameplayTags.ABILITY.SECT.FINISHER
        : GameplayTags.ABILITY.SECT.DEFENSIVE;
  return {
    slug: `sect.lingxiao.${args.id}`,
    name: args.name,
    type: AbilityType.ACTIVE_SKILL,
    tags: [...PHYSICAL_SECT_TAGS, GameplayTags.ABILITY.SECT.SWIFT_SWORD, roleTag, ...(args.extraTags ?? [])],
    mpCost: args.mpCost,
    cooldown: args.cooldown,
    priority: args.role === 'finisher' ? 42 : args.role === 'defensive' ? 26 : 30,
    targetPolicy: { team: args.targetTeam ?? (args.role === 'defensive' ? 'self' : 'enemy'), scope: 'single' },
    selectionProfile: {
      intents: args.role === 'defensive' ? ['defensive'] : ['damage'],
      rules: tacticRules(args.tactic, args.role),
    },
    castConditions: args.castConditions,
    effects: args.effects,
  };
}

export function projectLingxiaoCombat(args: {
  sect: CultivatorSectState;
  realm: RealmType;
}): SectCombatProjection | null {
  const { sect } = args;
  if (sect.status !== 'active' || sect.sectId !== 'lingxiao') return null;
  const swift = sect.pathId === 'swift-sword';
  const nodes = new Set(
    sect.meridianLoadouts.find((loadout) => loadout.slot === sect.activeMeridianSlot)?.nodeIds ?? [],
  );
  const templateMultiplier = swift
    ? 1 + (sect.methods['swift-sword-canon'] ?? 0) * 0.0008
    : 1;
  const coefficient = (value: number) => value * templateMultiplier;
  const baseMana = 8 + 4 * REALM_ORDER[args.realm];
  const mana = (weight: number) => Math.round(baseMana * weight);

  const defaultAttack: AbilityConfig = {
    slug: 'sect.lingxiao.plain-sword',
    name: '平剑式',
    type: AbilityType.ACTIVE_SKILL,
    tags: [...PHYSICAL_SECT_TAGS, GameplayTags.ABILITY.SECT.GENERATOR, GameplayTags.ABILITY.SECT.PLAIN_SWORD],
    targetPolicy: { team: 'enemy', scope: 'single' },
    effects: [damage(coefficient(0.8)), momentum(1)],
  };

  const configs: Record<Exclude<LingxiaoAbilityId, 'plain-sword'>, AbilityConfig> = {
    'guiding-sword': active({
      id: 'guiding-sword', name: swift ? '追风式' : '引剑式', mpCost: mana(1), cooldown: 0,
      role: 'generator', tactic: sect.tacticId,
      extraTags: [GameplayTags.ABILITY.SECT.GUIDING_SWORD],
      effects: [damage(coefficient(swift ? 0.9 : 0.85)), momentum(swift ? 2 : 1)],
    }),
    'linked-edge': active({
      id: 'linked-edge', name: swift ? '流光三叠' : '连锋式', mpCost: mana(1.5), cooldown: 2,
      role: 'combo', tactic: sect.tacticId,
      effects: [
        ...Array.from({ length: nodes.has('swift-split-light') ? 5 : 3 }, () =>
          damage(coefficient(nodes.has('swift-split-light') ? 0.27 : 0.42))),
        momentum(nodes.has('swift-split-light') ? 3 : 2),
        swordMark(),
        ...(nodes.has('swift-stacking-waves') ? [{ type: 'cooldown_modify' as const, params: { cdModifyValue: -1, tags: [GameplayTags.ABILITY.SECT.GENERATOR], maxCount: 1 } }] : []),
        ...(nodes.has('swift-linked-city') ? [{ type: 'cooldown_modify' as const, params: { cdModifyValue: -1, tags: [GameplayTags.ABILITY.SECT.SWIFT_SWORD] } }] : []),
      ],
    }),
    'turning-body': active({
      id: 'turning-body', name: swift ? '回燕式' : '回身式', mpCost: mana(1.25), cooldown: 3,
      role: 'defensive', tactic: sect.tacticId, targetTeam: 'enemy',
      effects: [damage(coefficient(0.65)), {
        type: 'apply_buff', params: { target: 'caster', buffConfig: {
          id: 'sect.lingxiao.returning-swallow', name: '回燕姿态', description: '提高闪避，闪避后可伺机反击。',
          type: BuffType.BUFF, duration: 1, stackRule: StackRule.REFRESH_DURATION,
          tags: [GameplayTags.BUFF.TYPE.BUFF, GameplayTags.BUFF.SECT.RETURNING_SWALLOW],
          modifiers: [{ attrType: AttributeType.EVASION_RATE, type: ModifierType.FIXED, value: 0.08 }],
          listeners: [{
            id: 'sect.lingxiao.returning-swallow-counter',
            eventType: GameplayTags.EVENT.DODGE,
            scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
            priority: 0,
            mapping: { caster: 'owner', target: 'event.caster' },
            effects: [
              damage(coefficient(nodes.has('swift-returning-swallow') ? 0.825 : 0.55)),
              momentum(1),
              ...(nodes.has('swift-returning-swallow') || nodes.has('swift-unending-wind') ? [swordMark()] : []),
              ...(nodes.has('swift-unending-wind') ? [{ type: 'shield' as const, params: { value: { attribute: AttributeType.ATK, coefficient: 0.4 } } }] : []),
            ],
          }],
        } },
      }],
    }),
    'breaking-edge': active({
      id: 'breaking-edge', name: swift ? '一线天' : '破锋式', mpCost: mana(1.75),
      cooldown: nodes.has('swift-shadow-line') ? 3 : 2, role: 'finisher', tactic: sect.tacticId,
      castConditions: [{ type: 'combat_resource_at_least', params: { resourceId: LINGXIAO_SWORD_MOMENTUM, value: nodes.has('swift-shadow-line') ? 6 : 3, scope: 'caster' } }],
      effects: [
        ...(nodes.has('swift-shadow-line') ? [{ type: 'next_hit_rule' as const, params: { forceCritical: true, triggers: 1 } }] : []),
        damage(coefficient((nodes.has('swift-shadow-line') ? 2.5 : nodes.has('swift-sheathing') ? 0.8 : 1) * (nodes.has('swift-still-tide') ? 1.2 : 1))),
        ...(nodes.has('swift-shadow-line') ? [] : Array.from({ length: 6 }, (_, index) => damage(coefficient(0.25 * (nodes.has('swift-sheathing') ? 0.8 : 1)), [{
          type: 'combat_resource_at_least', params: { resourceId: LINGXIAO_SWORD_MOMENTUM, value: index + 1, scope: 'caster' },
        }]))),
        ...(nodes.has('swift-life-chasing') ? [damage(coefficient(nodes.has('swift-shadow-line') ? 0.75 : 0.3), [{ type: 'hp_below', params: { value: 0.25, scope: 'target' } }])] : []),
        ...([{
          type: 'consume_status_trigger' as const,
          params: { match: { id: LINGXIAO_SWORD_MARK_BUFF }, consume: 'all' as const, scaleEffectsByLayer: true, effects: [{ type: 'damage' as const, params: { value: { attribute: AttributeType.ATK, coefficient: nodes.has('swift-mountain-breaking') ? 0.18 : 0.1 }, damageType: DamageType.PHYSICAL, bypassDefense: true } }] },
        } as EffectConfig]),
        consumeMomentum(),
        ...(nodes.has('swift-sheathing') ? [momentum(1), { type: 'shield' as const, params: { value: { attribute: AttributeType.ATK, coefficient: 0.5 } } }] : []),
        ...(nodes.has('swift-retained-force') ? [momentum(2)] : []),
        ...(nodes.has('swift-endless-flow') ? [damage(coefficient(0.6)), momentum(1)] : []),
        ...(nodes.has('swift-gapless') ? [{ type: 'ability_transform' as const, params: { id: 'sect.lingxiao.gapless', triggers: 1, appliesToTags: [GameplayTags.ABILITY.SECT.GUIDING_SWORD], freeManaCost: true } }] : []),
      ],
    }),
    'sword-aegis': active({
      id: 'sword-aegis', name: '剑罡护体', mpCost: mana(1.5), cooldown: 3,
      role: 'defensive', tactic: sect.tacticId,
      effects: [{ type: 'shield', params: { value: { attribute: AttributeType.ATK, coefficient: 0.6 } } }],
    }),
    'shadow-step': active({
      id: 'shadow-step', name: '踏影', mpCost: mana(1), cooldown: 2,
      role: 'generator', tactic: sect.tacticId,
      effects: [damage(coefficient(0.55)), { type: 'apply_buff', params: { target: 'caster', buffConfig: {
        id: 'sect.lingxiao.shadow-step', name: '踏影', type: BuffType.BUFF, duration: 1,
        stackRule: StackRule.REFRESH_DURATION, tags: [GameplayTags.BUFF.TYPE.BUFF],
        modifiers: [{ attrType: AttributeType.SPEED, type: ModifierType.ADD, value: 0.1 }],
      } } }],
    }),
    'instant-traceless': active({
      id: 'instant-traceless', name: '刹那无痕', mpCost: mana(2.5), cooldown: 4,
      role: 'finisher', tactic: sect.tacticId,
      castConditions: [{ type: 'combat_resource_at_least', params: { resourceId: LINGXIAO_SWORD_MOMENTUM, value: 6, scope: 'caster' } }],
      effects: [
        ...Array.from({ length: 6 }, () => damage(coefficient(0.4))),
        ...(nodes.has('swift-linked-city') ? [{ type: 'cooldown_modify' as const, params: { cdModifyValue: -1, tags: [GameplayTags.ABILITY.SECT.SWIFT_SWORD] } }] : []),
        consumeMomentum(), momentum(1),
      ],
    }),
  };

  const abilities = sect.abilityLoadout
    .filter((id): id is Exclude<LingxiaoAbilityId, 'plain-sword'> => id !== 'plain-sword' && isAbilityUnlocked(id, sect))
    .map((id) => configs[id]);

  if (nodes.has('swift-probing-edge')) {
    abilities.push({
      slug: 'sect.lingxiao.meridian.probing-edge',
      name: '试锋', type: AbilityType.PASSIVE_SKILL,
      tags: [GameplayTags.ABILITY.KIND.PASSIVE, GameplayTags.ABILITY.KIND.SECT, GameplayTags.ABILITY.SECT.LINGXIAO],
      listeners: [{
        id: 'sect.lingxiao.probing-edge.counter', eventType: GameplayTags.EVENT.SKILL_CAST,
        scope: GameplayTags.SCOPE.OWNER_AS_CASTER, priority: 0,
        mapping: { caster: 'owner', target: 'event.target' },
        effects: [{
          type: 'turn_state_counter',
          conditions: [{ type: 'ability_has_tag', params: { tag: GameplayTags.ABILITY.SECT.PLAIN_SWORD } }],
          params: { key: 'sect.lingxiao.probing-edge', event: 'damage_dealt', threshold: 2, resetOnTrigger: true, effects: [momentum(1), swordMark()] },
        }],
      }],
    });
  }
  if (nodes.has('swift-borrowed-force')) {
    abilities.push({
      slug: 'sect.lingxiao.meridian.borrowed-force', name: '借势', type: AbilityType.PASSIVE_SKILL,
      tags: [GameplayTags.ABILITY.KIND.PASSIVE, GameplayTags.ABILITY.KIND.SECT, GameplayTags.ABILITY.SECT.LINGXIAO],
      listeners: [{
        id: 'sect.lingxiao.borrowed-force.damage', eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET, priority: 0,
        mapping: { caster: 'owner', target: 'owner' }, effects: [momentum(1)],
      }],
    });
  }

  const passiveModifiers = Array.from(LINGXIAO_METHOD_BY_ID.values()).flatMap((method) => {
    if (!method.modifierPerLevel) return [];
    return [{ ...method.modifierPerLevel, value: method.modifierPerLevel.value * (sect.methods[method.id] ?? 0) }];
  });

  return {
    defaultAttack,
    abilities,
    passiveModifiers,
    resources: [{
      id: LINGXIAO_SWORD_MOMENTUM,
      name: '剑势',
      initial: nodes.has('swift-opening') ? 2 : 0,
      max: swift ? 6 : 3,
      decayOnNoDirectDamage: nodes.has('swift-still-tide') ? 0 : 1,
      decayOnControlledSkip: nodes.has('swift-guarded-edge') ? 0 : 1,
      pauseDecayWhileShielded: true,
    }],
    tacticId: sect.tacticId,
  };
}
