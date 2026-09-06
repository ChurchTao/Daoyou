import { DEFAULT_TARGET_COUNT } from "./constants.ts"
import type { BattleContext } from "./context.ts"
import { TargetMode, TargetSide } from "./enums.ts"
import { evalExpr, skillLevelOf } from "./expr.ts"
import { alliesOf, enemiesOf } from "./query.ts"
import { skillOf } from "./skills.ts"
import type { SkillDef, Unit } from "./types.ts"
import { isStanding, resourceOf } from "./units.ts"

/**
 * 选目标。隐身对单体不可选，群体（fill/all/random 且人数>1）仍能打到。
 * 感知/幽冥鬼眼可看破隐身。
 */
export function isUntargetableBy(ctx: BattleContext, source: Unit, target: Unit, aoe: boolean): boolean {
  if (aoe) return false
  if (sourceRevealsStealth(ctx, source)) return false
  return target.statuses.some((s) => ctx.statusDefs.get(s.id)?.untargetable)
}

export function sourceRevealsStealth(ctx: BattleContext, source: Unit): boolean {
  if (source.statuses.some((s) => ctx.statusDefs.get(s.id)?.revealStealth)) return true
  for (const id of source.passives) {
    if (skillOf(ctx.skills, source, id)?.innate?.revealStealth) return true
  }
  return false
}

export function canSelect(ctx: BattleContext, source: Unit, target: Unit, skill: SkillDef, aoe: boolean): boolean {
  if (target.flags.escaped) return false
  if (target.flags.dead && !skill.targeting.includeDead) return false
  if (target.flags.downed && !skill.targeting.includeDowned) return false
  if (!target.flags.downed && !target.flags.dead && !isStanding(target) && !skill.targeting.includeDowned) {
    return false
  }
  const side = skill.targeting.side
  if (side === TargetSide.Self) return target.id === source.id
  if (side === TargetSide.Enemy && target.side === source.side) return false
  if (side === TargetSide.Ally && target.side !== source.side) return false
  if (isUntargetableBy(ctx, source, target, aoe)) return false
  if (skill.targeting.requireStatusIds?.length && !skill.targeting.requireStatusIds.some((id) => target.statuses.some((status) => status.id === id))) return false
  if (skill.targeting.requireStatusKinds?.length && !skill.targeting.requireStatusKinds.some((kind) => target.statuses.some((status) => status.kind === kind))) return false
  return true
}

export function poolFor(ctx: BattleContext, source: Unit, skill: SkillDef): Unit[] {
  const side = skill.targeting.side
  let pool: Unit[]
  if (side === TargetSide.Self) pool = [source]
  else if (side === TargetSide.Enemy) pool = enemiesOf(ctx.state, source)
  else if (side === TargetSide.Ally) pool = alliesOf(ctx.state, source)
  else pool = ctx.state.units.filter((u) => !u.flags.escaped)

  if (skill.targeting.includeDowned) {
    const extra = ctx.state.units.filter((u) => {
      if (u.flags.escaped) return false
      if (side === TargetSide.Enemy && u.side === source.side) return false
      if (side === TargetSide.Ally && u.side !== source.side) return false
      if (side === TargetSide.Self) return u.id === source.id
      return u.flags.downed || u.flags.dead
    })
    pool = [...pool, ...extra.filter((u) => !pool.includes(u))]
  }

  const count = targetCount(source, skill, 1)
  const aoe = isAoe(skill, count)
  return pool
    .filter((u) => canSelect(ctx, source, u, skill, aoe))
    .sort((a, b) => a.slot - b.slot)
}

export function targetCount(source: Unit, skill: SkillDef, fallbackTargets: number): number {
  const resourceCount = skill.targeting.countByResource
    ?.filter((entry) => (resourceOf(source, entry.resourceId)?.current ?? 0) >= entry.min)
    .slice(-1)[0]?.count
  const raw = evalExpr(resourceCount ?? skill.targeting.count ?? DEFAULT_TARGET_COUNT, {
    skillLevel: skillLevelOf(source, skill.id),
    targets: fallbackTargets,
    source,
  })
  return Math.max(1, Math.floor(raw))
}

/** 群体才忽略隐身；explicit 单目标不算 AOE。 */
export function isAoe(skill: SkillDef, count: number): boolean {
  const mode = skill.targeting.mode ?? TargetMode.Explicit
  if (
    mode === TargetMode.All ||
    mode === TargetMode.Random ||
    mode === TargetMode.Fill ||
    mode === TargetMode.LowestHp ||
    mode === TargetMode.LowestDef
  ) {
    return count > 1 || mode === TargetMode.All
  }
  return count > 1
}

/**
 * fill：指令目标优先，再按站位补满人数（破釜、龙卷）。
 * lowestHp：按气血比例从低到高取（推气过宫）。
 */
export function resolveSkillTargets(
  ctx: BattleContext,
  source: Unit,
  skill: SkillDef,
  targetIds: string[],
  forcedPrimaryId?: string,
): Unit[] {
  const mode = skill.targeting.mode ?? TargetMode.Explicit
  if (skill.targeting.side === TargetSide.Self) return [source]

  const count = targetCount(source, skill, targetIds.length || 1)
  const pool = poolFor(ctx, source, skill)
  const aoe = isAoe(skill, count)

  if (mode === TargetMode.All) {
    const picked = skill.targeting.count === undefined ? pool : pool.slice(0, count)
    return addExtra(ctx, source, skill, picked, pool)
  }
  if (mode === TargetMode.Random) return addExtra(ctx, source, skill, shuffleTake(ctx, pool, count), pool)
  if (mode === TargetMode.LowestHp) {
    return addExtra(
      ctx,
      source,
      skill,
      pool
        .slice()
        .sort((a, b) => a.attrs.hp / Math.max(1, a.attrs.maxHp) - b.attrs.hp / Math.max(1, b.attrs.maxHp) || a.slot - b.slot)
        .slice(0, count),
      pool,
    )
  }
  if (mode === TargetMode.LowestDef) {
    return addExtra(
      ctx,
      source,
      skill,
      pool
        .slice()
        .sort((a, b) => a.attrs.physicalDef - b.attrs.physicalDef || a.slot - b.slot)
        .slice(0, count),
      pool,
    )
  }

  const picked: Unit[] = []
  const seen = new Set<string>()
  if (forcedPrimaryId) {
    const forced = ctx.state.units.find((unit) => unit.id === forcedPrimaryId)
    if (forced && forced.id !== source.id && isStanding(forced)) {
      picked.push(forced)
      seen.add(forced.id)
    }
  }
  for (const id of targetIds) {
    if (picked.length >= count) break
    const unit = ctx.state.units.find((u) => u.id === id)
    if (!unit || seen.has(unit.id)) continue
    if (!canSelect(ctx, source, unit, skill, aoe)) continue
    picked.push(unit)
    seen.add(unit.id)
    if (picked.length >= count) break
  }

  if (mode === TargetMode.Explicit) return addExtra(ctx, source, skill, picked, pool)

  for (const unit of pool) {
    if (seen.has(unit.id)) continue
    picked.push(unit)
    seen.add(unit.id)
    if (picked.length >= count) break
  }
  return addExtra(ctx, source, skill, picked, pool)
}

function addExtra(ctx: BattleContext, source: Unit, skill: SkillDef, picked: Unit[], pool: Unit[]): Unit[] {
  const extraCount = skill.targeting.extraCount
  const extraChance = skill.targeting.extraChance
  if (extraCount === undefined && extraChance === undefined) return picked
  const env = {
    skillLevel: skillLevelOf(source, skill.id),
    targets: picked.length,
    source,
  }
  if (extraChance !== undefined && !ctx.rng.chance(evalExpr(extraChance, env))) return picked
  const n = extraCount === undefined ? 0 : Math.max(0, Math.floor(evalExpr(extraCount, env)))
  if (n <= 0) return picked
  const seen = new Set(picked.map((u) => u.id))
  const more: Unit[] = []
  for (const unit of pool) {
    if (seen.has(unit.id)) continue
    more.push(unit)
    seen.add(unit.id)
    if (more.length >= n) break
  }
  return [...picked, ...more]
}

function shuffleTake(ctx: BattleContext, pool: Unit[], count: number): Unit[] {
  const copy = pool.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(ctx.rng.next() * (i + 1))
    const tmp = copy[i]
    copy[i] = copy[j]
    copy[j] = tmp
  }
  return copy.slice(0, count)
}
