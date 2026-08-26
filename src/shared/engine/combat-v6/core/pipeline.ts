/**
 * 回合管线：锁指令 → 按速度出手 → 交给 action 模块。
 */
import { resolveAction, turnOrder } from "./action.ts"
import type { BattleContext } from "./context.ts"
import { EventType } from "./enums.ts"

export { applyRoundFlags, clearRoundFlags, lockCommands, turnOrder } from "./action.ts"

export function resolveRoundActions(ctx: BattleContext): void {
  const order = turnOrder(ctx)
  ctx.emit({ type: EventType.TurnOrder, unitIds: order.map((u) => u.id) })
  for (const unit of order) {
    if (ctx.state.result) break
    resolveAction(ctx, unit)
  }
}
