/**
 * 效果原语派发。新增效果 = 注册一个 handler，不要在 applyEffect 里继续堆 if。
 */
import { DEFAULT_HITS } from "./constants.ts"
import type { BattleContext } from "./context.ts"
import { applyHeal, applyHpRestore, applyMpDamage, applyRevive, applyWound, resolveStrike } from "./damage.ts"
import { DamageKind, EffectType, EventType, FailReason, StatusHit, StatusRemoveReason } from "./enums.ts"
import { evalExpr } from "./expr.ts"
import { atLeast, floorAtLeast } from "./math.ts"
import { applyStatus, envFor, removeStatus } from "./status.ts"
import type { ExprEnv, SkillDef, SkillEffect, Unit } from "./types.ts"
import { isStanding, resourceOf } from "./units.ts"

type EffectHandler<T extends SkillEffect = SkillEffect> = (
  ctx: BattleContext,
  source: Unit,
  skill: SkillDef,
  effect: T,
  targets: Unit[],
  env: ExprEnv,
) => void

const handlers: { [K in SkillEffect["type"]]?: EffectHandler<Extract<SkillEffect, { type: K }>> } = {
  [EffectType.SkipNextAction]: (_ctx, source) => {
    source.flags.skipNextAction = true
  },
  [EffectType.ApplyStatus]: handleApplyStatus,
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
  [EffectType.PhysicalHit]: handleHit,
  [EffectType.SpellHit]: handleHit,
  [EffectType.ModifyStrike]: () => undefined,
  [EffectType.ModifyDefenseIgnore]: () => undefined,
  [EffectType.ModifyHeal]: () => undefined,
  [EffectType.SetCrit]: () => undefined,
  [EffectType.ModifyResource]: handleModifyResource,
  [EffectType.ModifyChance]: () => undefined,
  [EffectType.ClearSkipNextAction]: (_ctx, source) => {
    source.flags.skipNextAction = false
  },
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
    effect.type !== EffectType.ApplyStatus &&
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

function handleModifyResource(
  ctx: BattleContext,
  source: Unit,
  _skill: SkillDef,
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
  _skill: SkillDef,
  effect: Extract<SkillEffect, { type: typeof EffectType.ApplyStatus }>,
  targets: Unit[],
  env: ExprEnv,
): void {
  const dest = effect.self ? [source] : targets
  const duration = floorAtLeast(1, evalExpr(effect.duration, env))
  for (const t of dest) {
    const hit = effect.hit ?? StatusHit.Always
    if (hit === StatusHit.Seal) {
      const chance = ctx.rules.formulas.sealHitChance(source, t, env.skillLevel, _skill.sealBase)
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
    const ids = [
      ...(effect.statusIds ?? []),
      ...t.statuses.filter((s) => effect.kinds?.includes(s.kind)).map((s) => s.id),
      ...t.statuses
        .filter((s) => {
          const cat = ctx.statusDefs.get(s.id)?.category
          return cat !== undefined && effect.categories?.includes(cat)
        })
        .map((s) => s.id),
    ]
    for (const id of new Set(ids)) removeStatus(ctx, t, id, StatusRemoveReason.Dispel)
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
  effect: Extract<SkillEffect, { type: typeof EffectType.PhysicalHit | typeof EffectType.SpellHit }>,
  targets: Unit[],
  env: ExprEnv,
): void {
  const hits = floorAtLeast(1, evalExpr(effect.hits ?? DEFAULT_HITS, env))
  const coeffSpec = effect.coeff
  const coeffs: number[] = Array.isArray(coeffSpec)
    ? coeffSpec
    : Array.from({ length: hits }, () => coeffSpec ?? 1)
  const kind = effect.type === EffectType.PhysicalHit ? DamageKind.Physical : DamageKind.Spell
  const power = evalExpr(effect.power, env)

  for (const t of targets) {
    for (let i = 0; i < hits; i++) {
      // 横扫中途打死目标则后续刀取消。
      if (!isStanding(t) || ctx.state.result) break
      resolveStrike(ctx, {
        source,
        target: t,
        kind,
        coeff: coeffs[i] ?? 1,
        power,
        trueDamage: effect.trueDamage,
        defenseIgnore:
          effect.type === EffectType.PhysicalHit
            ? evalExpr(effect.defenseIgnore ?? 0, env)
            : 0,
        formula: effect.formula ?? skill.formula,
        skillLevel: env.skillLevel,
        targetCount: targets.length,
        schoolTerm: skill.schoolTerm,
        splash: skill.splash,
        skillId: skill.id,
        isPrimary: ctx.currentAction?.primaryTargetId === t.id,
      })
    }
  }
}

export function makeEnv(source: Unit, skill: SkillDef, targets: Unit[]): ExprEnv {
  return envFor(source, skill.id, targets.length, targets[0])
}
