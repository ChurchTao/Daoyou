import { materializeCommand, rememberCommand } from "./commands.ts"
import type { BattleContext } from "./context.ts"
import { BattlePhase, CommandType, EventType, HookName, HpZeroOutcome, MatchWinner, ResultReason, Team } from "./enums.ts"
import { BattleError, ErrorCode } from "./errors.ts"
import { HookBus } from "./hooks.ts"
import { clearRoundFlags, lockCommands, resolveRoundActions } from "./pipeline.ts"
import { commandOptions, teamFled, teamWiped, unitById } from "./query.ts"
import { SeededRng } from "./rng.ts"
import { bindDataHooks } from "./passives.ts"
import { clearBarriers, tickBarriers } from "./barriers.ts"
import { applyStatus, clearCombatStatuses, tickStatuses } from "./status.ts"
import type {
  BattleEvent,
  BattleResult,
  BattleState,
  CombatV6CommandOptions,
  Command,
  CreateBattleInput,
  SkillDef,
  StatusDef,
  Unit,
  UnitId,
} from "./types.ts"
import { cloneUnit, createUnit, isStanding } from "./units.ts"
import { validateLineup } from "./validate.ts"

/**
 * 一场战斗的主机入口。Host 只做三件事：submit 指令、lockAndResolve 推进回合、读 events。
 * 端游模型是「全员同时锁指令，再按速度串行结算」，不是我方回合/敌方回合。
 */
export class BattleSession {
  private readonly ctx: BattleContext
  private cursor = 0

  constructor(input: CreateBattleInput) {
    const rng = new SeededRng(input.seed)
    const units = input.units.map((u, i) => createUnit(u, i))
    const skills = new Map<string, SkillDef>((input.skills ?? []).map((s) => [s.id, s]))
    const statusDefs = new Map<string, StatusDef>((input.statusDefs ?? []).map((s) => [s.id, s]))
    const events: BattleEvent[] = []

    const ctx: BattleContext = {
      rng,
      rules: input.ruleset,
      skills,
      statusDefs,
      hooks: new HookBus(),
      events,
      state: {
        round: 1,
        phase: BattlePhase.Command,
        units,
        rngState: rng.state,
        versions: { ...input.versions },
      },
      emit: (event) => {
        events.push(event)
        if (event.type === EventType.ActionFailed && ctx.currentAction?.sourceId === event.unitId) {
          ctx.currentAction.failed = true
        }
      },
      applyHpZero: (unit, source, skillId, kind, origin) => this.applyHpZero(unit, source, skillId, kind, origin),
      checkEnd: (reason) => this.finishIfNeeded(reason),
      suppressHooks: 0,
    }
    this.ctx = ctx
    bindDataHooks(this.ctx)

    this.ctx.emit({
      type: EventType.BattleStart,
      seed: input.seed,
      unitIds: units.map((u) => u.id),
      versions: { ...input.versions },
    })
    this.ctx.emit({ type: EventType.RoundStart, round: 1 })
    this.ctx.hooks.emit(HookName.OnRoundStart)
    this.syncRng()
  }

  get state(): BattleState {
    return this.ctx.state
  }

  get hooks(): HookBus {
    return this.ctx.hooks
  }

  get finished(): boolean {
    return this.ctx.state.phase === BattlePhase.Ended
  }

  /** 开战以来的完整战报，UI/录像按顺序播放即可，不要重算规则。 */
  log(): readonly BattleEvent[] {
    return this.ctx.events
  }

  /** 取出尚未消费的事件；适合逐回合驱动动画。 */
  drain(): BattleEvent[] {
    const next = this.ctx.events.slice(this.cursor)
    this.cursor = this.ctx.events.length
    return next
  }

  /** 可序列化快照（含 RNG 状态），用于存档和对拍。 */
  snapshot(): BattleState {
    return {
      round: this.ctx.state.round,
      phase: this.ctx.state.phase,
      rngState: this.ctx.rng.state,
      versions: { ...this.ctx.state.versions },
      result: this.ctx.state.result ? { ...this.ctx.state.result } : undefined,
      units: this.ctx.state.units.map(cloneUnit),
    }
  }

  unit(id: UnitId): Unit {
    return unitById(this.ctx.state, id)
  }

  queryCommands(unitId: UnitId): CombatV6CommandOptions {
    return commandOptions(this.ctx, unitId)
  }

  /** 仅指令阶段可调用；锁指令后不可再改。超时未提交的单位由 lockAndResolve 补默认普攻。 */
  submit(unitId: UnitId, command: Command): void {
    if (this.ctx.state.phase !== BattlePhase.Command) {
      throw new BattleError(ErrorCode.CommandsLocked, "当前不在指令阶段，无法下达指令")
    }
    const unit = unitById(this.ctx.state, unitId)
    if (!isStanding(unit)) {
      throw new BattleError(ErrorCode.UnitCannotAct, `单位 ${unitId} 无法行动`)
    }
    const resolved = materializeCommand(this.ctx, unit, command)
    rememberCommand(unit, resolved)
    if (command.type === CommandType.Auto) unit.flags.auto = true
    this.ctx.emit({ type: EventType.CommandAccepted, unitId, command: resolved })
    this.syncRng()
  }

  /**
   * 指令期结束：补齐未下达指令（超时默认普通攻击 / NPC AI），然后按速度结算整轮。
   */
  lockAndResolve(): void {
    if (this.ctx.state.phase === BattlePhase.Ended) return
    if (this.ctx.state.phase !== BattlePhase.Command) {
      throw new BattleError(ErrorCode.NotCommandPhase, "当前不在指令阶段")
    }

    this.ctx.state.phase = BattlePhase.Resolve
    lockCommands(this.ctx)
    resolveRoundActions(this.ctx)

    if (!this.ctx.state.result) {
      tickStatuses(this.ctx)
      tickBarriers(this.ctx)
    }

    this.ctx.emit({ type: EventType.RoundEnd, round: this.ctx.state.round })
    this.ctx.hooks.emit(HookName.OnRoundEnd)
    this.finishIfNeeded()

    if (this.ctx.state.result) {
      this.syncRng()
      return
    }

    if (this.ctx.state.round >= this.ctx.rules.maxRounds) {
      this.end({ winner: MatchWinner.Draw, reason: ResultReason.RoundLimit })
      this.syncRng()
      return
    }

    this.ctx.state.round += 1
    for (const unit of this.ctx.state.units) clearRoundFlags(unit)
    this.ctx.state.phase = BattlePhase.Command
    this.ctx.emit({ type: EventType.RoundStart, round: this.ctx.state.round })
    this.ctx.hooks.emit(HookName.OnRoundStart)
    this.syncRng()
  }

  /** 测试/无操作主机：连续结算直到结束。 */
  runUntilEnd(maxRounds = this.ctx.rules.maxRounds): void {
    while (this.ctx.state.phase !== BattlePhase.Ended) {
      this.lockAndResolve()
      if (this.ctx.state.round > maxRounds + 1) break
    }
  }

  applyStatus(unitId: UnitId, statusId: string, duration: number, sourceId?: UnitId): void {
    const unit = unitById(this.ctx.state, unitId)
    applyStatus(this.ctx, unit, statusId, duration, sourceId ?? unitId)
  }

  /**
   * 先触发 onFatal（神佑等可在此把气血拉回正），仍 <=0 才倒地/死亡。
   * 人物倒地可被复活；召唤兽/NPC 本场死亡，不能再召。
   */
  private applyHpZero(unit: Unit, source?: Unit, skillId?: string, kind?: import("./enums.ts").DamageKind, origin?: import("./enums.ts").DamageOrigin): void {
    if (unit.flags.dead || unit.flags.downed) return
    this.ctx.hooks.emit(HookName.OnFatal, { source, target: unit, skillId, kind, origin })
    if (unit.attrs.hp > 0) return
    const outcome = this.ctx.rules.hpZeroOutcome(unit)
    clearCombatStatuses(this.ctx, unit)
    clearBarriers(this.ctx, unit)
    unit.attrs.hp = 0
    if (outcome === HpZeroOutcome.Downed) {
      unit.flags.downed = true
      this.ctx.emit({ type: EventType.UnitDowned, unitId: unit.id })
    } else {
      unit.flags.dead = true
      this.ctx.emit({ type: EventType.UnitDead, unitId: unit.id })
    }
    this.ctx.hooks.emit(HookName.OnDeath, { source, target: unit, skillId, kind, origin })
    this.finishIfNeeded(ResultReason.Wipe)
  }

  private finishIfNeeded(preferred?: BattleResult["reason"]): void {
    if (this.ctx.state.result) return
    const wiped0 = teamWiped(this.ctx.state, 0)
    const wiped1 = teamWiped(this.ctx.state, 1)
    if (wiped0 && wiped1) {
      this.end({
        winner: MatchWinner.Draw,
        reason: preferred === ResultReason.Flee ? ResultReason.Flee : ResultReason.Wipe,
      })
      return
    }
    if (wiped0) {
      const reason =
        preferred === ResultReason.Flee || teamFled(this.ctx.state, Team.A)
          ? ResultReason.Flee
          : ResultReason.Wipe
      this.end({ winner: Team.B, reason })
      return
    }
    if (wiped1) {
      const reason =
        preferred === ResultReason.Flee || teamFled(this.ctx.state, Team.B)
          ? ResultReason.Flee
          : ResultReason.Wipe
      this.end({ winner: Team.A, reason })
    }
  }

  private end(result: BattleResult): void {
    this.ctx.state.result = result
    this.ctx.state.phase = BattlePhase.Ended
    this.ctx.emit({ type: EventType.BattleEnd, winner: result.winner, reason: result.reason })
  }

  private syncRng(): void {
    this.ctx.state.rngState = this.ctx.rng.state
  }
}

/** 开打入口。技能表同 id 后写覆盖（测试覆盖兽决概率）；单位 id 不可重复。 */
export function createBattle(input: CreateBattleInput): BattleSession {
  validateLineup(input.units)
  return new BattleSession(input)
}
