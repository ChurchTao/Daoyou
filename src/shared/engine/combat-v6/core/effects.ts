/**
 * 效果原语派发。新增效果 = 注册一个 handler，不要在 applyEffect 里继续堆 if。
 */
import { DEFAULT_HITS } from "./constants.ts"
import type { BattleContext } from "./context.ts"
import { applyBarrier } from "./barriers.ts"
import { applyHeal, applyHpRestore, applyMpDamage, applyRevive, applyWound, changeWound, resolveStrike } from "./damage.ts"
import { DamageKind, EffectType, EventType, FailReason, FormulaFamily, StatusCategory, StatusHit, StatusRemoveReason } from "./enums.ts"
import { evalExpr } from "./expr.ts"
import { atLeast, floorAtLeast } from "./math.ts"
import { applyStatus, copyStatusInstance, envFor, removeStatus } from "./status.ts"
import { resolveSkillTargets } from "./targeting.ts"
import type { ExprEnv, SkillDef, SkillEffect, Unit } from "./types.ts"
import { isStanding, resourceOf } from "./units.ts"
import { matchesWhen, targetStatusStacks } from "./when.ts"

type EffectHandler<T extends SkillEffect = SkillEffect> = (
  ctx: BattleContext,
  source: Unit,
  skill: SkillDef,
  effect: T,
  targets: Unit[],
  env: ExprEnv,
) => void

const handlers: { [K in SkillEffect["type"]]?: EffectHandler<Extract<SkillEffect, { type: K }>> } = {
  [EffectType.RandomBranch]: handleRandomBranch,
  [EffectType.SkipNextAction]: (_ctx, source) => {
    source.flags.skipNextAction = true
  },
  [EffectType.ApplyStatus]: handleApplyStatus,
  [EffectType.RemoveStatus]: handleRemoveStatus,
  [EffectType.CopyStatus]: handleCopyStatus,
  [EffectType.EmitMechanic]: (ctx, source, _skill, effect, targets) => {
    ctx.emit({ type: EventType.MechanicTriggered, mechanicId: effect.mechanicId, name: effect.name, sourceId: source.id, targetId: targets[0]?.id })
  },
  [EffectType.Dispel]: handleDispel,
  [EffectType.Heal]: (ctx, source, _skill, effect, targets, env) => {
    const power = evalExpr(effect.power, env)
    for (const t of targets) applyHeal(ctx, source, t, power, effect.healMaxHp)
  },
  [EffectType.RestoreHp]: handleRestoreHp,
  [EffectType.RestoreMp]: handleRestoreMp,
  [EffectType.Revive]: handleRevive,
  [EffectType.DamageMp]: (ctx, source, _skill, effect, targets, env) => {
    const power = evalExpr(effect.power, env)
    for (const t of targets) applyMpDamage(ctx, source, t, power)
  },
  [EffectType.Wound]: (ctx, source, _skill, effect, targets, env) => {
    const power = evalExpr(effect.power, env)
    for (const t of targets) applyWound(ctx, source, t, power)
  },
  [EffectType.RemoveWound]: (ctx, source, _skill, effect, targets, env) => {
    for (const t of targets) {
      const base = Math.max(0, evalExpr(effect.power, { ...env, target: t }))
      const hooked = ctx.hooks.emit("onWoundCalc", { source, target: t, wound: base, skillId: ctx.currentAction?.skillId })
      changeWound(ctx, source, t, -Math.max(0, Math.floor(hooked.wound ?? base)))
    }
  },
  [EffectType.ApplyBarrier]: (ctx, source, _skill, effect, targets, env) => {
    for (const target of targets) {
      applyBarrier(ctx, source, target, {
        id: effect.id,
        kind: effect.kind,
        name: effect.name,
        amount: ctx.hooks.emit("onBarrierCalc", {
          source,
          target,
          barrier: evalExpr(effect.power, { ...env, target }),
          skillId: ctx.currentAction?.skillId,
        }).barrier ?? 0,
        duration: evalExpr(effect.duration, { ...env, target }),
      })
    }
  },
  [EffectType.PhysicalHit]: handleHit,
  [EffectType.SpellHit]: handleHit,
  [EffectType.FixedHit]: handleHit,
  [EffectType.ModifyStrike]: () => undefined,
  [EffectType.ModifyDefenseIgnore]: () => undefined,
  [EffectType.ModifyHeal]: () => undefined,
  [EffectType.ModifyBarrier]: () => undefined,
  [EffectType.ModifyWound]: () => undefined,
  [EffectType.SetCrit]: () => undefined,
  [EffectType.ModifyResource]: handleModifyResource,
  [EffectType.ModifyChance]: () => undefined,
  [EffectType.ClearSkipNextAction]: (_ctx, source) => {
    source.flags.skipNextAction = false
  },
}

function handleRandomBranch(
  ctx: BattleContext,
  source: Unit,
  skill: SkillDef,
  effect: Extract<SkillEffect, { type: typeof EffectType.RandomBranch }>,
  targets: Unit[],
  env: ExprEnv,
): void {
  const chance = Math.min(1, Math.max(0, evalExpr(effect.chance, env)))
  const success = ctx.rng.chance(chance)
  ctx.emit({
    type: EventType.ChanceResolved,
    branchId: effect.branchId,
    sourceId: source.id,
    targetId: targets[0]?.id,
    chance,
    success,
  })
  const branch = success ? effect.successEffects : effect.failureEffects
  for (const child of branch) {
    const resolved = child.targeting
      ? resolveSkillTargets(ctx, source, { ...skill, targeting: child.targeting }, targets.map((target) => target.id))
      : targets
    const matched = child.when
      ? resolved.filter((target) => matchesWhen(ctx, child.when, { source, target, skill, skillId: skill.id }))
      : resolved
    const childEnv = {
      ...env,
      target: matched[0] ?? env.target,
      targetStatusStacks: targetStatusStacks(ctx, child.when, matched[0] ?? env.target),
    }
    applyEffect(ctx, source, skill, child, matched, childEnv)
  }
}

function handleRestoreHp(
  ctx: BattleContext,
  source: Unit,
  skill: SkillDef,
  effect: Extract<SkillEffect, { type: typeof EffectType.RestoreHp }>,
  targets: Unit[],
  env: ExprEnv,
): void {
  let power = atLeast(0, Math.floor(evalExpr(effect.power, env)))
  const action = ctx.currentAction
  const gainKey = `${source.id}:${skill.id}`
  if (effect.maxGainPerAction !== undefined && action) {
    const cap = atLeast(0, Math.floor(evalExpr(effect.maxGainPerAction, env)))
    power = Math.min(power, Math.max(0, cap - (action.hpRestoreGains[gainKey] ?? 0)))
  }
  for (const target of targets) {
    const restored = applyHpRestore(ctx, source, target, power, {
      revive: effect.revive,
      clearStatuses: effect.clearStatuses,
    })
    if (action && restored > 0) {
      action.hpRestoreGains[gainKey] = (action.hpRestoreGains[gainKey] ?? 0) + restored
    }
  }
}

export function applyEffect(
  ctx: BattleContext,
  source: Unit,
  skill: SkillDef,
  effect: SkillEffect,
  targets: Unit[],
  env: ExprEnv,
): void {
  // 休息、给自己上状态、驱散可以没有敌方目标。
  if (
    effect.type !== EffectType.SkipNextAction &&
    effect.type !== EffectType.RandomBranch &&
    effect.type !== EffectType.ApplyStatus &&
    effect.type !== EffectType.RemoveStatus &&
    effect.type !== EffectType.CopyStatus &&
    effect.type !== EffectType.EmitMechanic &&
    effect.type !== EffectType.Dispel &&
    effect.type !== EffectType.ModifyStrike &&
    effect.type !== EffectType.ModifyDefenseIgnore &&
    effect.type !== EffectType.ModifyHeal &&
    effect.type !== EffectType.SetCrit &&
    effect.type !== EffectType.ModifyResource &&
    effect.type !== EffectType.ModifyChance &&
    effect.type !== EffectType.ClearSkipNextAction
  ) {
    if (targets.length === 0) {
      ctx.emit({ type: EventType.ActionFailed, unitId: source.id, reason: FailReason.NoTarget })
      return
    }
  }
  const handler = handlers[effect.type] as EffectHandler
  handler(ctx, source, skill, effect, targets, env)
}

function matchingStatuses(unit: Unit, spec: { statusIds?: string[]; kinds?: string[] }): Unit["statuses"] {
  return unit.statuses
    .filter((status) => spec.statusIds?.includes(status.id) || spec.kinds?.includes(status.kind))
    .sort((a, b) => a.appliedRound - b.appliedRound || a.id.localeCompare(b.id))
}

function handleRemoveStatus(
  ctx: BattleContext,
  _source: Unit,
  _skill: SkillDef,
  effect: Extract<SkillEffect, { type: typeof EffectType.RemoveStatus }>,
  targets: Unit[],
  env: ExprEnv,
): void {
  for (const target of targets) {
    const max = effect.maxCount === undefined ? Number.POSITIVE_INFINITY : Math.max(0, Math.floor(evalExpr(effect.maxCount, { ...env, target })))
    for (const status of matchingStatuses(target, effect).slice(0, max)) {
      removeStatus(ctx, target, status.id, StatusRemoveReason.Consumed)
    }
  }
}

function handleCopyStatus(
  ctx: BattleContext,
  source: Unit,
  _skill: SkillDef,
  effect: Extract<SkillEffect, { type: typeof EffectType.CopyStatus }>,
  targets: Unit[],
  env: ExprEnv,
): void {
  const primaryId = ctx.currentAction?.primaryTargetId
  const primary = primaryId ? ctx.state.units.find((unit) => unit.id === primaryId) : undefined
  if (!primary) return
  const max = effect.maxCount === undefined ? Number.POSITIVE_INFINITY : Math.max(0, Math.floor(evalExpr(effect.maxCount, env)))
  const statuses = matchingStatuses(primary, effect).slice(0, max)
  const durationAdd = Math.floor(evalExpr(effect.durationAdd ?? 0, env))
  for (const target of targets) {
    if (target.id === primary.id) continue
    for (const status of statuses) copyStatusInstance(ctx, source, target, status, durationAdd)
  }
}

function handleModifyResource(
  ctx: BattleContext,
  source: Unit,
  skill: SkillDef,
  effect: Extract<SkillEffect, { type: typeof EffectType.ModifyResource }>,
  _targets: Unit[],
  env: ExprEnv,
): void {
  const resource = resourceOf(source, effect.resourceId)
  if (!resource) return
  const before = resource.current
  let value = Math.floor(evalExpr(effect.amount, env))
  const action = ctx.currentAction
  const gainKey = `${source.id}:${resource.id}`
  if (effect.mode !== "set" && value > 0 && effect.maxGainPerAction !== undefined && action) {
    const cap = Math.max(0, Math.floor(evalExpr(effect.maxGainPerAction, env)))
    value = Math.min(value, Math.max(0, cap - (action.resourceGains[gainKey] ?? 0)))
  }
  const next = effect.mode === "set" ? value : before + value
  resource.current = Math.min(resource.max, Math.max(0, next))
  if (resource.current === before) return
  if (effect.mode !== "set" && resource.current > before && action) {
    action.resourceGains[gainKey] = (action.resourceGains[gainKey] ?? 0) + resource.current - before
  }
  ctx.emit({
    type: EventType.ResourceChanged,
    sourceId: source.id,
    unitId: source.id,
    resourceId: resource.id,
    before,
    after: resource.current,
  })
}

function handleApplyStatus(
  ctx: BattleContext,
  source: Unit,
  skill: SkillDef,
  effect: Extract<SkillEffect, { type: typeof EffectType.ApplyStatus }>,
  targets: Unit[],
  env: ExprEnv,
): void {
  const dest = effect.self ? [source] : targets
  const duration = floorAtLeast(1, evalExpr(effect.duration, env))
  for (const t of dest) {
    if ((t.flags.downed || t.flags.dead) && !(effect.targeting?.includeDowned ?? skill.targeting.includeDowned)) continue
    const hit = effect.hit ?? StatusHit.Always
    if (hit === StatusHit.Seal) {
      const chance = ctx.rules.formulas.sealHitChance(source, t, env.skillLevel, skill.sealBase)
      if (!ctx.rng.chance(chance)) {
        ctx.emit({ type: EventType.Miss, sourceId: source.id, targetId: t.id, kind: StatusHit.Seal })
        continue
      }
    }
    applyStatus(ctx, t, effect.statusId, duration, source.id, {
      storedTargetId: effect.storeTarget ? (t.id === source.id ? env.target?.id : t.id) : undefined,
      env: { ...env, target: t },
    })
  }
}

function handleDispel(
  ctx: BattleContext,
  source: Unit,
  _skill: SkillDef,
  effect: Extract<SkillEffect, { type: typeof EffectType.Dispel }>,
  targets: Unit[],
): void {
  const dest = targets.length ? targets : [source]
  for (const t of dest) {
    const priority = effect.categoryPriority ?? [StatusCategory.Control, StatusCategory.Debuff, StatusCategory.Dot, StatusCategory.Buff]
    const maxCount = effect.maxCount === undefined
      ? Number.POSITIVE_INFINITY
      : Math.max(0, Math.floor(evalExpr(effect.maxCount, { skillLevel: 0, targets: 1, source, target: t })))
    const candidates = t.statuses
      .filter((status) => {
        const def = ctx.statusDefs.get(status.id)
        if (def?.dispellable === false) return false
        if (effect.includeStatusFlags?.length && !effect.includeStatusFlags.some((flag) => Boolean(def?.[flag]))) return false
        if (effect.excludeStatusFlags?.some((flag) => Boolean(def?.[flag]))) return false
        return effect.statusIds?.includes(status.id) === true ||
          effect.kinds?.includes(status.kind) === true ||
          (def?.category !== undefined && effect.categories?.includes(def.category) === true)
      })
      .sort((a, b) => {
        const aCategory = ctx.statusDefs.get(a.id)?.category
        const bCategory = ctx.statusDefs.get(b.id)?.category
        const aPriority = aCategory === undefined ? priority.length : priority.indexOf(aCategory)
        const bPriority = bCategory === undefined ? priority.length : priority.indexOf(bCategory)
        return aPriority - bPriority || a.appliedRound - b.appliedRound || a.id.localeCompare(b.id)
      })
      .slice(0, maxCount)
    for (const status of candidates) removeStatus(ctx, t, status.id, StatusRemoveReason.Dispel)
  }
}

function handleRestoreMp(
  ctx: BattleContext,
  _source: Unit,
  _skill: SkillDef,
  effect: Extract<SkillEffect, { type: typeof EffectType.RestoreMp }>,
  targets: Unit[],
  env: ExprEnv,
): void {
  const power = atLeast(0, Math.floor(evalExpr(effect.power, env)))
  for (const t of targets) {
    const next = Math.min(t.attrs.maxMp, t.attrs.mp + power)
    const gained = next - t.attrs.mp
    t.attrs.mp = next
    if (gained > 0) {
      ctx.emit({ type: EventType.MpRestore, unitId: t.id, amount: gained, mpAfter: t.attrs.mp })
    }
  }
}

function handleRevive(
  ctx: BattleContext,
  source: Unit,
  _skill: SkillDef,
  effect: Extract<SkillEffect, { type: typeof EffectType.Revive }>,
  targets: Unit[],
  env: ExprEnv,
): void {
  for (const t of targets) {
    const hp =
      effect.hpRatio !== undefined
        ? t.attrs.maxHp * evalExpr(effect.hpRatio, { ...env, target: t })
        : evalExpr(effect.hp, { ...env, target: t })
    applyRevive(ctx, source, t, hp)
  }
}

function handleHit(
  ctx: BattleContext,
  source: Unit,
  skill: SkillDef,
  effect: Extract<SkillEffect, { type: typeof EffectType.PhysicalHit | typeof EffectType.SpellHit | typeof EffectType.FixedHit }>,
  targets: Unit[],
  env: ExprEnv,
): void {
  const hits = floorAtLeast(1, evalExpr(effect.hits ?? DEFAULT_HITS, env))
  const coeffSpec = effect.coeff
  const coeffs: number[] = Array.isArray(coeffSpec)
    ? coeffSpec
    : Array.from({ length: hits }, () => coeffSpec ?? 1)
  const formula = effect.formula ?? skill.formula
  const trueDamage = effect.type === EffectType.FixedHit ? true : effect.trueDamage
  const fixed = effect.type === EffectType.FixedHit || trueDamage === true || formula === FormulaFamily.Fixed || formula === FormulaFamily.Judge
  const kind = fixed
    ? DamageKind.Fixed
    : effect.type === EffectType.PhysicalHit
      ? DamageKind.Physical
      : DamageKind.Spell
  const power = evalExpr(effect.power, env)

  for (const t of targets) {
    if (effect.when?.targetSlot === "primary" && ctx.currentAction?.primaryTargetId !== t.id) continue
    for (let i = 0; i < hits; i++) {
      // 横扫中途打死目标则后续刀取消。
      if (!isStanding(t) || ctx.state.result) break
      resolveStrike(ctx, {
        source,
        target: t,
        kind,
        coeff: coeffs[i] ?? 1,
        power,
        trueDamage,
        defenseIgnore:
          effect.type === EffectType.PhysicalHit || effect.type === EffectType.SpellHit
            ? evalExpr(effect.defenseIgnore ?? 0, env)
            : 0,
        cannotMiss: effect.type === EffectType.PhysicalHit ? effect.cannotMiss : kind === DamageKind.Fixed,
        cannotKill: effect.cannotKill,
        formula,
        skillLevel: env.skillLevel,
        targetCount: env.targets,
        schoolTerm: skill.schoolTerm,
        splash: skill.splash,
        skillId: skill.id,
        isPrimary: ctx.currentAction?.primaryTargetId === t.id,
        origin: effect.type === EffectType.FixedHit ? effect.origin : undefined,
      })
    }
  }
}

export function makeEnv(source: Unit, skill: SkillDef, targets: Unit[]): ExprEnv {
  return envFor(source, skill.id, targets.length, targets[0])
}
