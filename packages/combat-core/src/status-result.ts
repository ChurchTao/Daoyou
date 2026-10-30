import type { BattleContext } from './context.js';
import { HookName, type StatusHit } from './enums.js';
import type { SkillId, StatusApplyResult, StatusId, Unit, UnitId } from './types.js';

export type StatusResolutionOptions = {
  skillId?: SkillId;
  hit?: StatusHit;
  chance?: number;
  duration?: number;
  reason?: string;
};

/** An actual status outcome, rather than the enclosing command's success. */
export function reportStatusResult(
  ctx: BattleContext,
  target: Unit,
  statusId: StatusId,
  sourceId: UnitId,
  result: StatusApplyResult,
  options: StatusResolutionOptions = {},
): StatusApplyResult {
  const def = ctx.statusDefs.get(statusId);
  ctx.hooks.emit(HookName.OnStatusResolved, {
    source: ctx.state.units.find(unit => unit.id === sourceId),
    target,
    skillId: options.skillId,
    statusId,
    statusKind: def?.kind,
    statusCategory: def?.category,
    statusHit: options.hit,
    statusResult: result,
    statusChance: options.chance,
    statusDuration: options.duration,
    statusReason: options.reason,
  });
  return result;
}
