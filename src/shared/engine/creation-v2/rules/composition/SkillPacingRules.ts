import { GameplayTags } from '@shared/engine/shared/tag-domain';
import {
  CREATION_PROJECTION_BALANCE,
  CREATION_SKILL_DEFAULTS,
} from '../../config/CreationBalance';
import type { EffectConfig, ListenerConfig } from '../../contracts/battle';
import { BuffType } from '../../contracts/battle';
import type {
  CreationSkillProjectionContext,
  RolledAffix,
} from '../../types';
import type { ProjectionQualityProfile } from '../../analysis/ProjectionQualityProfile';

export interface SkillPacingInput {
  coreType: string;
  abilityTags: string[];
  effects: EffectConfig[];
  listeners?: ListenerConfig[];
  affixes: RolledAffix[];
  projectionQualityProfile: ProjectionQualityProfile;
  projectionContext?: CreationSkillProjectionContext;
}

export interface SkillPacingResult {
  cooldown: number;
  mpCost: number;
  priority: number;
  traceMessage: string;
}

type SkillPacingRole = NonNullable<CreationSkillProjectionContext['role']>;

const ROLE_COOLDOWN_LIMITS: Record<SkillPacingRole, { min: number; max: number }> = {
  offense: { min: 2, max: 5 },
  control: { min: 2, max: 5 },
  guard: { min: 3, max: 6 },
  sustain: { min: 3, max: 6 },
};

const ROLE_MP_RATIO_BASE: Record<SkillPacingRole, number> = {
  offense: 0.12,
  control: 0.14,
  guard: 0.13,
  sustain: 0.16,
};

const QUALITY_MP_ANCHOR_BY_ORDER = [
  520,
  680,
  1160,
  2120,
  4040,
  5320,
  6600,
  7880,
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundTo10(value: number): number {
  return Math.max(0, Math.round(value / 10) * 10);
}

function collectEffects(
  effects: readonly EffectConfig[],
  listeners: readonly ListenerConfig[] | undefined,
): EffectConfig[] {
  return [
    ...effects,
    ...(listeners ?? []).flatMap((listener) => listener.effects),
  ];
}

function hasAbilityFunction(
  abilityTags: readonly string[],
  tag: string,
): boolean {
  return abilityTags.includes(tag);
}

function isControlBuff(effect: EffectConfig): boolean {
  if (effect.type !== 'apply_buff') return false;
  const buff = effect.params.buffConfig;
  return (
    buff.type === BuffType.CONTROL ||
    (buff.tags ?? []).some((tag) =>
      tag.startsWith(GameplayTags.BUFF.TYPE.CONTROL) ||
      tag.startsWith(GameplayTags.STATUS.CONTROL.ROOT) ||
      tag.startsWith(GameplayTags.STATUS.CONTROL.STUNNED),
    )
  );
}

function resolveRole(args: {
  coreType: string;
  abilityTags: readonly string[];
  effects: readonly EffectConfig[];
  projectionContext?: CreationSkillProjectionContext;
}): SkillPacingRole {
  const explicit = args.projectionContext?.role;
  if (explicit) return explicit;

  if (args.coreType === 'heal') return 'sustain';
  if (
    hasAbilityFunction(args.abilityTags, GameplayTags.ABILITY.FUNCTION.CONTROL) ||
    args.effects.some(isControlBuff)
  ) {
    return 'control';
  }
  if (
    args.coreType === 'apply_buff' ||
    args.coreType === 'shield' ||
    hasAbilityFunction(args.abilityTags, GameplayTags.ABILITY.FUNCTION.BUFF)
  ) {
    return 'guard';
  }
  return 'offense';
}

function resolveBaseCooldown(role: SkillPacingRole): number {
  return role === 'guard' || role === 'sustain'
    ? CREATION_SKILL_DEFAULTS.buffCooldown
    : CREATION_SKILL_DEFAULTS.damageCooldown;
}

function resolveQualityCooldownAdd(qualityOrder: number): number {
  if (qualityOrder >= 5) return 2;
  if (qualityOrder >= 3) return 1;
  return 0;
}

function resolveQualityMpAnchor(qualityOrder: number): number {
  return (
    QUALITY_MP_ANCHOR_BY_ORDER[qualityOrder] ??
    QUALITY_MP_ANCHOR_BY_ORDER[0]
  );
}

function resolveMpCost(args: {
  qualityOrder: number;
  mpRatio: number;
}): number {
  const qualityAnchor = resolveQualityMpAnchor(args.qualityOrder);
  return roundTo10(
    Math.max(
      60,
      qualityAnchor * args.mpRatio,
    ),
  );
}

export function resolveSkillResourceAndCooldown(
  input: SkillPacingInput,
): SkillPacingResult {
  const allEffects = collectEffects(input.effects, input.listeners);
  const role = resolveRole({
    coreType: input.coreType,
    abilityTags: input.abilityTags,
    effects: allEffects,
    projectionContext: input.projectionContext,
  });
  const qualityOrder = input.projectionQualityProfile.qualityOrder;
  const nonCoreAffixCount = input.affixes.filter(
    (affix) => affix.slot !== 'core',
  ).length;
  const rareAffixCount = input.affixes.filter(
    (affix) => affix.rarity === 'rare' || affix.rarity === 'legendary',
  ).length;
  const hasDamage = hasAbilityFunction(
    input.abilityTags,
    GameplayTags.ABILITY.FUNCTION.DAMAGE,
  );
  const hasHardControl =
    hasAbilityFunction(input.abilityTags, GameplayTags.ABILITY.FUNCTION.CONTROL) ||
    allEffects.some(isControlBuff);
  const healEffectCount = allEffects.filter((effect) => effect.type === 'heal').length;
  const hasDispel = allEffects.some((effect) => effect.type === 'dispel');

  let complexityCooldownAdd = 0;
  if (nonCoreAffixCount >= 2) complexityCooldownAdd += 1;
  if (hasHardControl && hasDamage) {
    complexityCooldownAdd += 1;
  }
  if (healEffectCount > 1 || (healEffectCount > 0 && hasDispel)) {
    complexityCooldownAdd += 1;
  }

  const limits = ROLE_COOLDOWN_LIMITS[role];
  const cooldown = clamp(
    resolveBaseCooldown(role) +
      complexityCooldownAdd +
      resolveQualityCooldownAdd(qualityOrder),
    limits.min,
    limits.max,
  );

  const paceModifier =
    input.projectionContext?.paceProfile === 'aggressive'
      ? -0.015
      : input.projectionContext?.paceProfile === 'sustain'
        ? 0.01
        : 0;
  const mpRatio = clamp(
    ROLE_MP_RATIO_BASE[role] +
      qualityOrder * 0.012 +
      nonCoreAffixCount * 0.015 +
      rareAffixCount * 0.03 +
      paceModifier,
    0.06,
    role === 'guard' || role === 'sustain' ? 0.28 : 0.24,
  );
  const mpCost = resolveMpCost({
    qualityOrder,
    mpRatio,
  });

  const priority =
    CREATION_PROJECTION_BALANCE.skillPriorityBase + input.affixes.length;

  return {
    cooldown,
    mpCost,
    priority,
    traceMessage:
      `skill pacing: role=${role}, cooldown=${cooldown}, mpCost=${mpCost}, ` +
      `qualityOrder=${qualityOrder}, mpRatio=${mpRatio.toFixed(3)}, ` +
      `qualityAnchor=${resolveQualityMpAnchor(qualityOrder)}, ` +
      `nonCore=${nonCoreAffixCount}, rare=${rareAffixCount}`,
  };
}
