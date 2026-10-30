import type { BattleContext } from './context.js';
import { DamageOrigin, EventType, HookName } from './enums.js';
import type { SkillId, Unit } from './types.js';
import { isStanding } from './units.js';

/** The first damage segment of this root command is intercepted. Later segments still connect. */
export function interceptHostileAction(
  ctx: BattleContext,
  source: Unit,
  target: Unit,
  skillId?: SkillId,
  origin: DamageOrigin = DamageOrigin.ActionDirect,
): boolean {
  if (source.side === target.side || !isStanding(target) ||
      origin !== DamageOrigin.ActionDirect || ctx.suppressHooks > 0 ||
      ctx.currentAction?.sourceId !== source.id) return false;
  const action = ctx.hostileAction ?? ctx.currentAction;
  if (action.sourceId !== source.id) return false;
  const intercepted = action.interceptedTargetIds ??= [];
  ctx.currentAction.interceptedTargetIds = intercepted;
  if (intercepted.includes(target.id)) return true;
  if (target.flags.hostileActionGuardRound === ctx.state.round) return false;
  const status = target.statuses.find(instance => ctx.statusDefs.get(instance.id)?.interceptHostileAction);
  if (!status) return false;
  intercepted.push(target.id);
  target.flags.hostileActionGuardRound = ctx.state.round;
  const def = ctx.statusDefs.get(status.id)!;
  ctx.emit({ type: EventType.MechanicTriggered, mechanicId: status.id, name: def.name,
    sourceId: target.id, targetId: source.id });
  ctx.hooks.emit(HookName.OnHostileActionIntercepted, {
    source, target, skillId, statusId: status.id, statusKind: status.kind, origin,
  });
  return true;
}
