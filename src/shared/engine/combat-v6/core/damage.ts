/**
 * 单次打击：命中 → 公式 → 必杀/波动/防御 → 扣血。
 * 修炼、师门项、分灵都在 rules.baseDamage 里算，这里只把 skillLevel / 人数传过去。
 */
import { MIN_DAMAGE, MIN_HP, MIN_MAX_HP } from "./constants.ts"
import type { BattleContext } from "./context.ts"
import { DamageKind, EventType, FailReason, FormulaFamily, HookName } from "./enums.ts"
import { atLeast, floorAtLeast } from "./math.ts"
import { alliesOf, tryUnit } from "./query.ts"
import { breakStatusesOnDamage } from "./status.ts"
import { isUntargetableBy } from "./targeting.ts"
import type { DamageKind as DamageKindType, SchoolTerm, SkillDef, SplashSpec, Unit } from "./types.ts"
import { damageTakenFactor, effectiveAttrs, healDealtFactor, healTakenFactor, isStanding } from "./units.ts"

export type StrikeInput = {
  source: Unit
  target: Unit
  kind: DamageKindType
  coeff: number
  power: number
  trueDamage?: boolean
  formula?: string
  skillLevel?: number
  targetCount?: number
  schoolTerm?: SchoolTerm
  splash?: SplashSpec
  skillId?: string
  isPrimary?: boolean
}

export function resolveStrike(ctx: BattleContext, input: StrikeInput): void {
  // 物理才会触发保护；法术不拦。危机保护未实现。
  const source = input.source
  let target = input.target
  const src = effectiveAttrs(source)
  const dst = effectiveAttrs(target)
  const silent = ctx.suppressHooks > 0

  if (input.kind === DamageKind.Physical) {
    const protector = findProtector(ctx, target)
    if (protector) {
      ctx.emit({ type: EventType.ProtectTrigger, protectorId: protector.id, originalTargetId: target.id })
      target = protector
    }
  }

  if (!rollHit(ctx, source, target, src, dst, input.kind)) return

  const fury = input.kind === DamageKind.Physical && ctx.rng.chance(src.physicalFuryRate)
  const skillId = input.skillId ?? ctx.currentAction?.skillId
  const isPrimary =
    input.isPrimary ?? (ctx.currentAction?.primaryTargetId !== undefined && target.id === ctx.currentAction.primaryTargetId)
  let crit =
    input.kind === DamageKind.Physical
      ? ctx.rng.chance(src.critRate)
      : ctx.rng.chance(src.spellCritRate)
  const critRoll = ctx.hooks.emit(HookName.OnCritRoll, {
    source,
    target,
    kind: input.kind,
    skillId,
    isPrimary,
    crit,
  })
  crit = critRoll.crit ?? crit

  let raw = computeBase(ctx, source, target, src, dst, input, fury)
  raw = applyCrit(ctx, raw, crit)
  raw = applyFluctuation(ctx, raw, input.kind)
  raw = applyDefend(ctx, target, input.kind, raw)
  raw = floorAtLeast(MIN_DAMAGE, raw * damageTakenFactor(target, input.kind))

  const hooked = ctx.hooks.emit(HookName.OnHitCalc, {
    source,
    target,
    damage: raw,
    kind: input.kind,
    skillId,
    isPrimary,
  })
  const amount = floorAtLeast(MIN_DAMAGE, hooked.damage ?? raw)

  ctx.emit({
    type: EventType.Hit,
    sourceId: source.id,
    targetId: target.id,
    kind: input.kind,
    crit,
    fury,
  })

  applyDamage(ctx, source, target, amount, input.kind, silent)
  if (!silent) {
    ctx.hooks.emit(HookName.AfterHit, {
      source,
      target,
      damage: amount,
      kind: input.kind,
      skillId,
      isPrimary,
    })
  }
}

function findProtector(ctx: BattleContext, target: Unit): Unit | undefined {
  if (!isStanding(target)) return undefined
  return alliesOf(ctx.state, target).find(
    (ally) => ally.flags.protecting === target.id && isStanding(ally) && ally.id !== target.id,
  )
}

function withAttrs(unit: Unit, attrs: ReturnType<typeof effectiveAttrs>): Unit {
  return { ...unit, attrs }
}

function rollHit(
  ctx: BattleContext,
  source: Unit,
  target: Unit,
  src: ReturnType<typeof effectiveAttrs>,
  dst: ReturnType<typeof effectiveAttrs>,
  kind: DamageKindType,
): boolean {
  const formulas = ctx.rules.formulas
  const chance =
    kind === DamageKind.Physical
      ? formulas.physicalHitChance(withAttrs(source, src), withAttrs(target, dst))
      : formulas.spellHitChance(withAttrs(source, src), withAttrs(target, dst))
  if (ctx.rng.chance(chance)) return true
  ctx.emit({ type: EventType.Miss, sourceId: source.id, targetId: target.id, kind })
  return false
}

function computeBase(
  ctx: BattleContext,
  source: Unit,
  target: Unit,
  src: ReturnType<typeof effectiveAttrs>,
  dst: ReturnType<typeof effectiveAttrs>,
  input: StrikeInput,
  fury: boolean,
): number {
  const family =
    input.formula ??
    (input.trueDamage
      ? FormulaFamily.Fixed
      : input.kind === DamageKind.Physical
        ? FormulaFamily.Physical
        : FormulaFamily.Spell)
  return ctx.rules.formulas.baseDamage({
    family,
    kind: input.kind,
    source: withAttrs(source, src),
    target: withAttrs(target, dst),
    coeff: input.coeff,
    power: input.power,
    fury,
    furyMultiplier: ctx.rules.formulas.furyAtkMultiplier,
    skillLevel: input.skillLevel ?? 0,
    targetCount: input.targetCount ?? 1,
    schoolTerm: input.schoolTerm,
    splash: input.splash,
  })
}

function applyCrit(ctx: BattleContext, raw: number, crit: boolean): number {
  if (!crit) return raw
  return Math.floor(raw * ctx.rules.formulas.critMultiplier)
}

function applyFluctuation(ctx: BattleContext, raw: number, kind: DamageKindType): number {
  const formulas = ctx.rules.formulas
  const min =
    kind === DamageKind.Physical ? formulas.physicalFluctuationMin : formulas.fluctuationMin
  const max =
    kind === DamageKind.Physical ? formulas.physicalFluctuationMax : formulas.fluctuationMax
  return floorAtLeast(MIN_DAMAGE, raw * ctx.rng.range(min, max))
}

function applyDefend(ctx: BattleContext, target: Unit, kind: DamageKindType, raw: number): number {
  if (kind !== DamageKind.Physical || !target.flags.defending) return raw
  return floorAtLeast(MIN_DAMAGE, raw * ctx.rules.formulas.defendPhysicalFactor)
}

/** silent=true 表示来自钩子的二次打击，不再触发 onBeHit（避免反击/反震互爆）。 */
export function applyDamage(
  ctx: BattleContext,
  source: Unit,
  target: Unit,
  amount: number,
  kind: DamageKindType,
  silent = false,
): void {
  if (!isStanding(target) || target.flags.downed) return

  const kept = redirectOverflow(ctx, source, target, amount, kind)
  const hp = atLeast(0, target.attrs.hp - kept)
  target.attrs.hp = hp
  ctx.lastStrikeDamage = kept
  ctx.emit({
    type: EventType.Damage,
    sourceId: source.id,
    targetId: target.id,
    amount: kept,
    hpAfter: hp,
    kind,
  })
  if (!silent) {
    ctx.hooks.emit(HookName.OnBeHit, {
      source,
      target,
      damage: kept,
      kind,
      skillId: ctx.currentAction?.skillId,
      isPrimary: ctx.currentAction?.primaryTargetId === target.id,
    })
  }
  breakStatusesOnDamage(ctx, target)
  if (hp <= 0) ctx.applyHpZero(target)
}

/** 我佛慈悲一类：目标留下 keep，其余打到状态来源。 */
function redirectOverflow(
  ctx: BattleContext,
  source: Unit,
  target: Unit,
  amount: number,
  kind: DamageKindType,
): number {
  const inst = target.statuses.find((s) => ctx.statusDefs.get(s.id)?.redirectTaken)
  const spec = inst ? ctx.statusDefs.get(inst.id)?.redirectTaken : undefined
  if (!inst || !spec) return amount
  const caster = tryUnit(ctx.state, inst.sourceId)
  const kept = atLeast(0, Math.floor(amount * spec.keep))
  const bounced = atLeast(0, Math.floor(amount * spec.toCaster))
  if (caster && isStanding(caster) && caster.id !== target.id && bounced > 0) {
    const hp = atLeast(0, caster.attrs.hp - bounced)
    caster.attrs.hp = hp
    ctx.emit({
      type: EventType.Damage,
      sourceId: source.id,
      targetId: caster.id,
      amount: bounced,
      hpAfter: hp,
      kind,
    })
    if (hp <= 0) ctx.applyHpZero(caster)
  }
  return kept
}

/** 倒地单位不受治疗，只能走 revive。 */
export function applyHeal(ctx: BattleContext, source: Unit, target: Unit, power: number, healMaxHp = false): void {
  if (target.flags.dead || target.flags.escaped || target.flags.downed) return

  if (healMaxHp) {
    const amount = floorAtLeast(MIN_DAMAGE, power + source.attrs.healPower)
    target.attrs.maxHp += amount
    ctx.emit({ type: EventType.Heal, sourceId: source.id, targetId: target.id, amount, hpAfter: target.attrs.hp })
    return
  }

  const amount = floorAtLeast(MIN_DAMAGE, power + effectiveAttrs(source).healPower)
  const isPrimary =
    ctx.currentAction?.primaryTargetId !== undefined && target.id === ctx.currentAction.primaryTargetId
  const taken = healTakenFactor(target) * healDealtFactor(source)
  const hooked = ctx.hooks.emit(HookName.OnHealCalc, {
    source,
    target,
    heal: amount * taken,
    skillId: ctx.currentAction?.skillId,
    isPrimary,
  })
  const finalHeal = floorAtLeast(0, hooked.heal ?? amount * taken)
  const hp = Math.min(target.attrs.maxHp, target.attrs.hp + finalHeal)
  const healed = hp - target.attrs.hp
  target.attrs.hp = hp
  if (healed > 0) {
    ctx.emit({ type: EventType.Heal, sourceId: source.id, targetId: target.id, amount: healed, hpAfter: hp })
  }
}

export function applyRevive(ctx: BattleContext, source: Unit, target: Unit, hp: number): boolean {
  if (target.flags.escaped) return false
  const needsRevive = target.flags.downed || target.flags.dead || target.attrs.hp <= 0
  if (!needsRevive) return false
  if (target.statuses.some((s) => ctx.statusDefs.get(s.id)?.blocksRevive)) {
    ctx.emit({ type: EventType.ActionFailed, unitId: source.id, reason: FailReason.ReviveBlocked })
    return false
  }
  const restored = Math.max(MIN_HP, Math.min(target.attrs.maxHp, Math.floor(hp)))
  target.attrs.hp = restored
  target.flags.downed = false
  target.flags.dead = false
  ctx.emit({ type: EventType.UnitRevived, unitId: target.id, hp: restored })
  ctx.emit({ type: EventType.Heal, sourceId: source.id, targetId: target.id, amount: restored, hpAfter: restored })
  return true
}

export function applyMpDamage(ctx: BattleContext, source: Unit, target: Unit, amount: number): void {
  if (!isStanding(target)) return
  const lost = Math.max(0, Math.min(target.attrs.mp, Math.floor(amount)))
  target.attrs.mp -= lost
  if (lost > 0) {
    ctx.emit({ type: EventType.MpDamage, sourceId: source.id, targetId: target.id, amount: lost, mpAfter: target.attrs.mp })
  }
}

export function applyWound(ctx: BattleContext, source: Unit, target: Unit, amount: number): void {
  if (!isStanding(target)) return
  const lost = Math.max(0, Math.min(target.attrs.maxHp - MIN_MAX_HP, Math.floor(amount)))
  if (lost <= 0) return
  target.attrs.maxHp -= lost
  if (target.attrs.hp > target.attrs.maxHp) target.attrs.hp = target.attrs.maxHp
  ctx.emit({ type: EventType.Wound, sourceId: source.id, targetId: target.id, amount: lost, maxHpAfter: target.attrs.maxHp })
}

/** 原目标死亡/隐身时转火：按敌方站位取下一个可打的存活者。 */
export function resolveAliveTarget(
  ctx: BattleContext,
  source: Unit,
  targetId: string | undefined,
  _skill?: SkillDef,
): Unit | undefined {
  void _skill
  const current = targetId ? tryUnit(ctx.state, targetId) : undefined
  if (
    current &&
    isStanding(current) &&
    current.side !== source.side &&
    !isUntargetableBy(ctx, source, current, false)
  ) {
    return current
  }

  const fallback = ctx.state.units
    .filter((u) => u.side !== source.side && isStanding(u) && !isUntargetableBy(ctx, source, u, false))
    .sort((a, b) => a.slot - b.slot)[0]
  if (fallback && current && current.id !== fallback.id) {
    ctx.emit({ type: EventType.Retarget, unitId: source.id, from: current.id, to: fallback.id })
  } else if (fallback && !current && targetId) {
    ctx.emit({ type: EventType.Retarget, unitId: source.id, from: targetId, to: fallback.id })
  }
  return fallback
}
