/**
 * 指令规范化。超时/自动战斗在这里变成具体攻击，不进入结算层。
 * 药品、捕捉尚未实现，锁指令后会报 unsupported。
 */
import type { BattleContext } from "./context.ts"
import { CommandType } from "./enums.ts"
import { enemiesOf, firstEnemy } from "./query.ts"
import type { Command, Unit } from "./types.ts"

const UNSUPPORTED = new Set<Command["type"]>([CommandType.Item, CommandType.Catch])

export function isUnsupported(command: Command): boolean {
  return UNSUPPORTED.has(command.type)
}

export function materializeCommand(ctx: BattleContext, unit: Unit, command: Command): Command {
  if (command.type === CommandType.Auto) {
    unit.flags.auto = true
    if (unit.lastCommand && unit.lastCommand.type !== CommandType.Auto) {
      return materializeCommand(ctx, unit, unit.lastCommand)
    }
    return defaultAttack(ctx, unit)
  }
  if (command.type === CommandType.Attack && !command.target) {
    return defaultAttack(ctx, unit)
  }
  return command
}

/** 优先打上回合目标，否则按敌方站位取第一个存活者。 */
export function defaultAttack(ctx: BattleContext, unit: Unit): Command {
  const last = unit.lastTargetId
  const still = last ? enemiesOf(ctx.state, unit).find((e) => e.id === last) : undefined
  const target = still ?? firstEnemy(ctx.state, unit)
  if (!target) return { type: CommandType.Defend }
  return { type: CommandType.Attack, target: target.id }
}

export function fillMissingCommand(ctx: BattleContext, unit: Unit): Command {
  if (unit.flags.auto && unit.lastCommand && unit.lastCommand.type !== CommandType.Auto) {
    return materializeCommand(ctx, unit, unit.lastCommand)
  }
  return ctx.rules.decideCommand({
    unit,
    state: ctx.state,
    enemies: enemiesOf(ctx.state, unit),
    allies: ctx.state.units.filter((u) => u.side === unit.side && u.id !== unit.id),
  })
}

export function rememberCommand(unit: Unit, command: Command): void {
  unit.command = command
  if (command.type !== CommandType.Auto) unit.lastCommand = command
  if (command.type === CommandType.Attack) unit.lastTargetId = command.target
  if (command.type === CommandType.Skill && command.targets[0]) unit.lastTargetId = command.targets[0]
  if (command.type === CommandType.Protect) unit.lastTargetId = command.target
}
