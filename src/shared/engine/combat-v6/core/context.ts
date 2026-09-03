/** 一场战斗的可变上下文。不要把 Host（时钟、UI）塞进来。 */
import type { HookBus } from "./hooks.ts"
import type { SeededRng } from "./rng.ts"
import type {
  BattleEvent,
  BattleResult,
  BattleState,
  Ruleset,
  SkillDef,
  SkillId,
  StatusDef,
  StatusId,
  Unit,
  UnitId,
} from "./types.ts"

export type BattleContext = {
  state: BattleState
  rng: SeededRng
  rules: Ruleset
  skills: Map<SkillId, SkillDef>
  statusDefs: Map<StatusId, StatusDef>
  hooks: HookBus
  events: BattleEvent[]
  emit: (event: BattleEvent) => void
  applyHpZero: (unit: Unit, source?: Unit, skillId?: SkillId) => void
  checkEnd: (reason?: BattleResult["reason"]) => void
  /** >0 时命中不再触发 afterHit/onBeHit，避免连击/反击/反震互爆 */
  suppressHooks: number
  /** 当前这次出手；OnHitCalc / when.skillIds 读这里。 */
  currentAction?: {
    skillId: SkillId
    sourceId: UnitId
    primaryTargetId?: UnitId
    targetIds: UnitId[]
    /** 同步行动内的资源获取计数；行动结束即销毁。 */
    resourceGains: Record<string, number>
    /** 独立气血恢复的行动内累计量；行动结束即销毁。 */
    hpRestoreGains: Record<string, number>
  }
  /** 最近一次打击扣血，给后续「按伤害扣蓝」用。 */
  lastStrikeDamage?: number
}
