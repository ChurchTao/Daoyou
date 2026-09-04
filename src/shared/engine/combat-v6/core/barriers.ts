import type { BattleContext } from "./context.ts"
import { EventType } from "./enums.ts"
import { atLeast, floorAtLeast } from "./math.ts"
import type { Unit } from "./types.ts"
import { isStanding } from "./units.ts"

export function applyBarrier(
  ctx: BattleContext,
  source: Unit,
  target: Unit,
  spec: { id: string; kind: string; name: string; amount: number; duration: number },
): void {
  if (!isStanding(target)) return
  const amount = atLeast(0, Math.floor(spec.amount))
  const duration = floorAtLeast(1, spec.duration)
  if (amount <= 0) return
  const existing = target.barriers.find((barrier) => barrier.kind === spec.kind)
  if (existing) {
    const before = existing.current
    existing.current = Math.max(existing.current, amount)
    existing.remainingRounds = duration
    existing.sourceId = source.id
    existing.appliedRound = ctx.state.round
    ctx.emit({
      type: EventType.BarrierChanged,
      sourceId: source.id,
      unitId: target.id,
      barrierId: existing.id,
      before,
      after: existing.current,
      reason: "refreshed",
    })
    return
  }
  target.barriers.push({
    id: spec.id,
    kind: spec.kind,
    name: spec.name,
    current: amount,
    remainingRounds: duration,
    sourceId: source.id,
    appliedRound: ctx.state.round,
  })
  ctx.emit({
    type: EventType.BarrierChanged,
    sourceId: source.id,
    unitId: target.id,
    barrierId: spec.id,
    before: 0,
    after: amount,
    reason: "applied",
  })
}

export function absorbBarriers(ctx: BattleContext, target: Unit, amount: number): number {
  let remaining = atLeast(0, Math.floor(amount))
  const ordered = target.barriers
    .filter((barrier) => barrier.current > 0)
    .sort((a, b) => a.appliedRound - b.appliedRound || a.id.localeCompare(b.id))
  for (const barrier of ordered) {
    if (remaining <= 0) break
    const before = barrier.current
    const absorbed = Math.min(before, remaining)
    barrier.current -= absorbed
    remaining -= absorbed
    ctx.emit({
      type: EventType.BarrierChanged,
      sourceId: barrier.sourceId,
      unitId: target.id,
      barrierId: barrier.id,
      before,
      after: barrier.current,
      reason: "absorbed",
    })
  }
  target.barriers = target.barriers.filter((barrier) => barrier.current > 0)
  return remaining
}

export function tickBarriers(ctx: BattleContext): void {
  for (const unit of ctx.state.units) {
    for (const barrier of [...unit.barriers]) {
      if (barrier.appliedRound === ctx.state.round) continue
      barrier.remainingRounds -= 1
      if (barrier.remainingRounds > 0) continue
      unit.barriers = unit.barriers.filter((candidate) => candidate !== barrier)
      ctx.emit({
        type: EventType.BarrierChanged,
        sourceId: barrier.sourceId,
        unitId: unit.id,
        barrierId: barrier.id,
        before: barrier.current,
        after: 0,
        reason: "expired",
      })
    }
  }
}

export function clearBarriers(ctx: BattleContext, unit: Unit): void {
  for (const barrier of unit.barriers) {
    ctx.emit({
      type: EventType.BarrierChanged,
      sourceId: barrier.sourceId,
      unitId: unit.id,
      barrierId: barrier.id,
      before: barrier.current,
      after: 0,
      reason: "downed",
    })
  }
  unit.barriers = []
}
