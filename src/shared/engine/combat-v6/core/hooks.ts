/**
 * 战斗内钩子总线。被动技能在 bindDataHooks 里订阅。
 * cancelled / damage 是钩子回写通道（跳过出手、改最终伤害）。
 */
import type { DamageKind, DamageOrigin, HookName } from "./enums.ts"
import type { BattleEvent, SkillId, Unit } from "./types.ts"

export type { HookName }

export type HookContext = {
  source?: Unit
  target?: Unit
  event?: BattleEvent
  cancelled?: boolean
  /** 钩子可改最终伤害 */
  damage?: number
  /** 本次伤害实际扣除的气血，不包含过量部分。 */
  hpDamage?: number
  /** 钩子可改物理忽防比例，最终由伤害入口夹取到 0～1。 */
  defenseIgnore?: number
  /** 钩子可改治疗量 */
  heal?: number
  kind?: DamageKind
  origin?: DamageOrigin
  skillId?: SkillId
  isPrimary?: boolean
  crit?: boolean
  chance?: number
}

export type HookFn = (ctx: HookContext) => void

export class HookBus {
  private listeners = new Map<HookName, HookFn[]>()

  on(name: HookName, fn: HookFn): void {
    const list = this.listeners.get(name)
    if (list) list.push(fn)
    else this.listeners.set(name, [fn])
  }

  emit(name: HookName, ctx: HookContext = {}): HookContext {
    for (const fn of this.listeners.get(name) ?? []) fn(ctx)
    return ctx
  }
}
