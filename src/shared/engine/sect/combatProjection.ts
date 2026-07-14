import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import type {
  AbilityConfig,
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
import type { RealmType } from '@shared/types/constants';
import { projectLingxiaoAbilityDetail } from './guide';
import { projectSectMethodModifiers } from './methodModifiers';
import { isAbilityUnlocked } from './progression';
import type {
  CultivatorSectState,
  LingxiaoAbilityId,
  SectCombatProjection,
} from './types';

export const LINGXIAO_SWORD_MOMENTUM = 'sect.lingxiao.sword-momentum';
export const LINGXIAO_SWORD_MARK_BUFF = 'sect.lingxiao.sword-mark';
export const LINGXIAO_RETURNING_SWALLOW_BUFF = 'sect.lingxiao.returning-swallow';
export const LINGXIAO_SHADOW_STEP_BUFF = 'sect.lingxiao.shadow-step';

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

function active(args: {
  id: LingxiaoAbilityId;
  name: string;
  mpCost: number;
  cooldown: number;
  effects: EffectConfig[];
  role: 'generator' | 'combo' | 'finisher' | 'defensive';
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
  const detail = (abilityId: LingxiaoAbilityId) =>
    projectLingxiaoAbilityDetail({ abilityId, sect, realm: args.realm });
  const plain = detail('plain-sword');
  const guiding = detail('guiding-sword');
  const linked = detail('linked-edge');
  const turning = detail('turning-body');
  const breaking = detail('breaking-edge');
  const aegis = detail('sword-aegis');
  const shadow = detail('shadow-step');
  const instant = detail('instant-traceless');

  const defaultAttack: AbilityConfig = {
    slug: 'sect.lingxiao.plain-sword',
    name: plain.name,
    type: AbilityType.ACTIVE_SKILL,
    tags: [...PHYSICAL_SECT_TAGS, GameplayTags.ABILITY.SECT.GENERATOR, GameplayTags.ABILITY.SECT.PLAIN_SWORD],
    targetPolicy: { team: 'enemy', scope: 'single' },
    effects: [damage(plain.effect.damageCoefficient ?? 0), momentum(plain.effect.momentumGain ?? 0)],
  };

  const configs: Record<Exclude<LingxiaoAbilityId, 'plain-sword'>, AbilityConfig> = {
    'guiding-sword': active({
      id: 'guiding-sword', name: guiding.name, mpCost: guiding.manaCost, cooldown: guiding.cooldown,
      role: 'generator',
      extraTags: [GameplayTags.ABILITY.SECT.GUIDING_SWORD],
      effects: [damage(guiding.effect.damageCoefficient ?? 0), momentum(guiding.effect.momentumGain ?? 0)],
    }),
    'linked-edge': active({
      id: 'linked-edge', name: linked.name, mpCost: linked.manaCost, cooldown: linked.cooldown,
      role: 'combo',
      effects: [
        ...Array.from({ length: linked.effect.hits ?? 1 }, () =>
          damage(linked.effect.damageCoefficient ?? 0)),
        momentum(linked.effect.momentumGain ?? 0),
        swordMark(),
        ...(nodes.has('swift-stacking-waves') ? [{ type: 'cooldown_modify' as const, params: { cdModifyValue: -1, tags: [GameplayTags.ABILITY.SECT.GENERATOR], maxCount: 1 } }] : []),
        ...(nodes.has('swift-linked-city') ? [{ type: 'cooldown_modify' as const, params: { cdModifyValue: -1, tags: [GameplayTags.ABILITY.SECT.SWIFT_SWORD] } }] : []),
      ],
    }),
    'turning-body': active({
      id: 'turning-body', name: turning.name, mpCost: turning.manaCost, cooldown: turning.cooldown,
      role: 'defensive', targetTeam: 'enemy',
      effects: [damage(turning.effect.damageCoefficient ?? 0), {
        type: 'apply_buff', params: { target: 'caster', buffConfig: {
          id: LINGXIAO_RETURNING_SWALLOW_BUFF, name: '回燕姿态', description: '提高闪避，闪避后可伺机反击。',
          type: BuffType.BUFF, duration: 2, stackRule: StackRule.REFRESH_DURATION,
          tags: [GameplayTags.BUFF.TYPE.BUFF, GameplayTags.BUFF.SECT.RETURNING_SWALLOW],
          modifiers: [{ attrType: AttributeType.EVASION_RATE, type: ModifierType.FIXED, value: 0.08 }],
          listeners: [{
            id: 'sect.lingxiao.returning-swallow-counter',
            eventType: GameplayTags.EVENT.DODGE,
            scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
            priority: 0,
            mapping: { caster: 'owner', target: 'event.caster' },
            effects: [
              damage(turning.effect.counterCoefficient ?? 0),
              momentum(turning.effect.momentumGain ?? 0),
              ...(nodes.has('swift-returning-swallow') || nodes.has('swift-unending-wind') ? [swordMark()] : []),
              ...(turning.effect.shieldCoefficient ? [{ type: 'shield' as const, params: { value: { attribute: AttributeType.ATK, coefficient: turning.effect.shieldCoefficient } } }] : []),
            ],
          }],
        } },
      }],
    }),
    'breaking-edge': active({
      id: 'breaking-edge', name: breaking.name, mpCost: breaking.manaCost,
      cooldown: breaking.cooldown, role: 'finisher',
      castConditions: [{ type: 'combat_resource_at_least', params: { resourceId: LINGXIAO_SWORD_MOMENTUM, value: breaking.effect.momentumRequired ?? 3, scope: 'caster' } }],
      effects: [
        ...(breaking.effect.forcedCritical ? [{ type: 'next_hit_rule' as const, params: { forceCritical: true, triggers: 1 } }] : []),
        damage(breaking.effect.damageCoefficient ?? 0),
        ...(nodes.has('swift-shadow-line') ? [] : Array.from({ length: 6 }, (_, index) => damage(breaking.effect.momentumDamageCoefficient ?? 0, [{
          type: 'combat_resource_at_least', params: { resourceId: LINGXIAO_SWORD_MOMENTUM, value: index + 1, scope: 'caster' },
        }]))),
        ...(breaking.effect.lowHpBonusCoefficient ? [damage(breaking.effect.lowHpBonusCoefficient, [{ type: 'hp_below', params: { value: 0.25, scope: 'target' } }])] : []),
        ...([{
          type: 'consume_status_trigger' as const,
          params: { match: { id: LINGXIAO_SWORD_MARK_BUFF }, consume: 'all' as const, scaleEffectsByLayer: true, effects: [{ type: 'damage' as const, params: { value: { attribute: AttributeType.ATK, coefficient: breaking.effect.swordMarkDamageCoefficient ?? 0.1 }, damageType: DamageType.PHYSICAL, bypassDefense: true } }] },
        } as EffectConfig]),
        consumeMomentum(),
        ...(nodes.has('swift-sheathing') ? [momentum(1), { type: 'shield' as const, params: { value: { attribute: AttributeType.ATK, coefficient: 0.5 } } }] : []),
        ...(nodes.has('swift-retained-force') ? [momentum(2)] : []),
        ...(nodes.has('swift-endless-flow') ? [damage(0.6 * (1 + (sect.methods['swift-sword-canon'] ?? 0) * 0.0008)), momentum(1)] : []),
        ...(nodes.has('swift-gapless') ? [{ type: 'ability_transform' as const, params: { id: 'sect.lingxiao.gapless', triggers: 1, appliesToTags: [GameplayTags.ABILITY.SECT.GUIDING_SWORD], freeManaCost: true } }] : []),
      ],
    }),
    'sword-aegis': active({
      id: 'sword-aegis', name: aegis.name, mpCost: aegis.manaCost, cooldown: aegis.cooldown,
      role: 'defensive',
      effects: [{ type: 'shield', params: { value: { attribute: AttributeType.ATK, coefficient: aegis.effect.shieldCoefficient ?? 0 } } }],
    }),
    'shadow-step': active({
      id: 'shadow-step', name: shadow.name, mpCost: shadow.manaCost, cooldown: shadow.cooldown,
      role: 'generator',
      effects: [damage(shadow.effect.damageCoefficient ?? 0), { type: 'apply_buff', params: { target: 'caster', buffConfig: {
        id: LINGXIAO_SHADOW_STEP_BUFF, name: '踏影', type: BuffType.BUFF, duration: 2,
        stackRule: StackRule.REFRESH_DURATION, tags: [GameplayTags.BUFF.TYPE.BUFF],
        modifiers: [{ attrType: AttributeType.SPEED, type: ModifierType.ADD, value: shadow.effect.speedBonus ?? 0 }],
      } } }],
    }),
    'instant-traceless': active({
      id: 'instant-traceless', name: instant.name, mpCost: instant.manaCost, cooldown: instant.cooldown,
      role: 'finisher',
      castConditions: [{ type: 'combat_resource_at_least', params: { resourceId: LINGXIAO_SWORD_MOMENTUM, value: instant.effect.momentumRequired ?? 6, scope: 'caster' } }],
      effects: [
        ...Array.from({ length: instant.effect.hits ?? 1 }, () => damage(instant.effect.damageCoefficient ?? 0)),
        ...(nodes.has('swift-linked-city') ? [{ type: 'cooldown_modify' as const, params: { cdModifyValue: -1, tags: [GameplayTags.ABILITY.SECT.SWIFT_SWORD] } }] : []),
        consumeMomentum(), momentum(instant.effect.momentumGain ?? 0),
      ],
    }),
  };

  const abilities = sect.abilityLoadout
    .filter((id): id is Exclude<LingxiaoAbilityId, 'plain-sword'> => id !== null && id !== 'plain-sword' && isAbilityUnlocked(id, sect))
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

  return {
    defaultAttack,
    abilities,
    methodModifiers: projectSectMethodModifiers(sect),
    resources: [{
      id: LINGXIAO_SWORD_MOMENTUM,
      name: '剑势',
      initial: nodes.has('swift-opening') ? 2 : 0,
      max: swift ? 6 : 3,
      decayOnNoDirectDamage: nodes.has('swift-still-tide') ? 0 : 1,
      decayOnControlledSkip: nodes.has('swift-guarded-edge') ? 0 : 1,
      pauseDecayWhileShielded: true,
    }],
    selectionStrategyId: 'sect.lingxiao.sword.v1',
    tacticId: sect.tacticId,
  };
}
