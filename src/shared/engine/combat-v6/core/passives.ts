/**
 * 把技能表里的 hooks 绑到 HookBus。连击/反击/反震走这里，不要在引擎里写兽决 id。
 * suppressHooks 期间的打击不再触发 afterHit/onBeHit，避免连击连环、反击反震互爆。
 */
import type { BattleContext } from "./context.ts"
import { applyEffect, makeEnv } from "./effects.ts"
import { EffectType, HookAim, HookName, TargetMode } from "./enums.ts"
import { evalExpr } from "./expr.ts"
import type { HookContext } from "./hooks.ts"
import { skillOf } from "./skills.ts"
import { enemiesOf } from "./query.ts"
import type { HookAim as HookAimType, SkillDef, SkillEffect, SkillHook, Unit } from "./types.ts"
import { consumeWhen, matchesWhen, type WhenScope } from "./when.ts"
import { isStanding } from "./units.ts"

export function bindDataHooks(ctx: BattleContext): void {
  for (const unit of ctx.state.units) {
    const known = [...unit.passives, ...unit.skills]
    const seen = new Set<string>()
    for (const id of known) {
      if (seen.has(id)) continue
      seen.add(id)
      const skill = skillOf(ctx.skills, unit, id)
      if (!skill?.hooks?.length) continue
      // 高级连击与连击不能同时生效，以 conflicts 声明为准。
      if (skill.conflicts?.some((other) => unit.passives.includes(other) || unit.skills.includes(other))) {
        continue
      }
      skill.hooks.forEach((hook, hookIndex) => {
        ctx.hooks.on(hook.on, (hctx) => {
          if (hook.targetIsSelf && hctx.target?.id !== unit.id) return
          if (hook.sourceIsSelf && hctx.source?.id !== unit.id) return
          if (hook.requireKind && hctx.kind !== hook.requireKind) return
          if (unit.flags.escaped || unit.flags.benched) return
          if (unit.flags.dead && hook.on !== HookName.OnFatal) return

          const skillId = hctx.skillId ?? ctx.currentAction?.skillId
          const actor = hctx.source ?? unit
          const actionSkill = skillId ? skillOf(ctx.skills, actor, skillId) : undefined
          const scope: WhenScope = {
            source: unit,
            target: hctx.target,
            skill: actionSkill,
            skillId,
            kind: hctx.kind ?? hook.requireKind,
            origin: hctx.origin,
            isPrimary: hctx.isPrimary,
            markKey: `${skill.id}:${hookIndex}`,
          }
          if (!matchesWhen(ctx, hook.when, scope)) return

          if (hook.limitConsumption === "onAttempt") consumeWhen(ctx, hook.when, scope)

          const env = {
            ...makeEnv(unit, skill, hctx.target ? [hctx.target] : []),
            damage: hctx.damage,
            hpDamage: hctx.hpDamage,
          }
          if (hook.chance !== undefined && !ctx.rng.chance(evalExpr(hook.chance, env))) return

          const targets = resolveHookTargets(ctx, hook, unit, hctx)
          const usable = hook.effects.filter((effect) => matchesWhen(ctx, effect.when, { ...scope, markKey: `${scope.markKey}:${effect.type}` }))
          if (usable.length === 0 && hook.effects.length > 0) return
          if (targets.length === 0 && usable.some((e) => needsHookTarget(e))) return

          ctx.suppressHooks += 1
          try {
            for (const effect of usable.length ? usable : hook.effects) {
              applyHookEffect(ctx, unit, skill, effect, targets, env, hctx)
            }
          } finally {
            ctx.suppressHooks -= 1
          }
          if (hook.limitConsumption !== "onAttempt") consumeWhen(ctx, hook.when, scope)
          for (const effect of usable) consumeWhen(ctx, effect.when, { ...scope, markKey: `${scope.markKey}:${effect.type}` })
        })
      })
    }
  }
}

function needsHookTarget(effect: SkillEffect): boolean {
  return (
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
  )
}

function applyHookEffect(
  ctx: BattleContext,
  unit: Unit,
  skill: SkillDef,
  effect: SkillEffect,
  targets: Unit[],
  env: ReturnType<typeof makeEnv> & { damage?: number; hpDamage?: number },
  hctx: HookContext,
): void {
  if (effect.type === EffectType.ModifyStrike) {
    const factor = evalExpr(effect.factor ?? 1, env)
    const add = evalExpr(effect.add ?? 0, env)
    hctx.damage = (hctx.damage ?? 0) * factor + add
    return
  }
  if (effect.type === EffectType.ModifyDefenseIgnore) {
    const factor = evalExpr(effect.factor ?? 1, env)
    const add = evalExpr(effect.add ?? 0, env)
    hctx.defenseIgnore = (hctx.defenseIgnore ?? 0) * factor + add
    return
  }
  if (effect.type === EffectType.ModifyHeal) {
    const factor = evalExpr(effect.factor ?? 1, env)
    const add = evalExpr(effect.add ?? 0, env)
    hctx.heal = (hctx.heal ?? 0) * factor + add
    return
  }
  if (effect.type === EffectType.SetCrit) {
    hctx.crit = true
    return
  }
  if (effect.type === EffectType.ModifyChance) {
    const factor = evalExpr(effect.factor ?? 1, env)
    const add = evalExpr(effect.add ?? 0, env)
    hctx.chance = (hctx.chance ?? 0) * factor + add
    return
  }
  applyEffect(ctx, unit, skill, effect, targets, env)
}

function resolveHookTargets(
  ctx: BattleContext,
  hook: SkillHook,
  unit: Unit,
  hctx: { source?: Unit; target?: Unit },
): Unit[] {
  const aim: HookAimType | undefined = hook.aim
  if (aim === HookAim.HookSource) return hctx.source ? [hctx.source] : []
  if (aim === HookAim.Self) return [unit]
  if (aim === HookAim.HookTarget) return hctx.target ? [hctx.target] : []
  if (aim === HookAim.Others) {
    const exclude = new Set<string>([unit.id, hctx.target?.id].filter((id): id is string => Boolean(id)))
    const pool = enemiesOf(ctx.state, unit).filter((u) => isStanding(u) && !exclude.has(u.id))
    const count = Math.max(1, Math.floor(evalExpr(hook.aimCount ?? 1, { skillLevel: 0, targets: pool.length, source: unit })))
    return pickByMode(ctx, pool, hook.aimMode ?? TargetMode.Random, count)
  }
  if (hctx.target) return [hctx.target]
  return [unit]
}

function pickByMode(ctx: BattleContext, pool: Unit[], mode: string, count: number): Unit[] {
  const copy = pool.slice()
  if (mode === TargetMode.LowestHp) {
    copy.sort((a, b) => a.attrs.hp / Math.max(1, a.attrs.maxHp) - b.attrs.hp / Math.max(1, b.attrs.maxHp) || a.slot - b.slot)
    return copy.slice(0, count)
  }
  if (mode === TargetMode.LowestDef) {
    copy.sort((a, b) => a.attrs.physicalDef - b.attrs.physicalDef || a.slot - b.slot)
    return copy.slice(0, count)
  }
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(ctx.rng.next() * (i + 1))
    const tmp = copy[i]
    copy[i] = copy[j]
    copy[j] = tmp
  }
  return copy.slice(0, count)
}
