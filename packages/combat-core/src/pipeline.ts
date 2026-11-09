/**
 * 回合管线：锁指令 → 防御/保护生效 → 按速度结算行动及行动尾钩。
 */
import { cancelDefensiveWindow, prepareDefensiveCommands, resolveAction, turnOrder } from "./action.js"
import type { BattleContext } from "./context.js"
import { EventType } from "./enums.js"

export { applyRoundFlags, clearRoundFlags, lockCommands, turnOrder } from "./action.js"

export function resolveRoundActions(ctx: BattleContext, afterAction?: () => void): void {
  const order = turnOrder(ctx)
  ctx.emit({ type: EventType.TurnOrder, unitIds: order.map((u) => u.id) })
  const defensiveCommands = prepareDefensiveCommands(ctx, order, afterAction)
  for (const unit of order) {
    if (ctx.state.result) break
    resolveAction(ctx, unit, defensiveCommands.get(unit.id))
    defensiveCommands.delete(unit.id)
    afterAction?.()
  }
  // The battle may end before a prepared defender reaches its ordinary tail.
  // Notify lifecycle observers of cancellation; passive effects must not run.
  for (const unit of order) {
    if (!defensiveCommands.has(unit.id)) continue
    cancelDefensiveWindow(ctx, unit)
  }
}
