import { MIN_MAX_HP } from './constants.js';
import type { BattleContext } from './context.js';
import { EventType, HookName, StatusFlag, StatusRemoveReason } from './enums.js';
import { recordHpLoss } from './hp-loss.js';
import type { StatusId, Unit } from './types.js';
import { recoverableHp } from './units.js';

export function removeStatus(
  ctx: BattleContext,
  unit: Unit,
  statusId: StatusId,
  reason: string,
  sourceId?: string,
  remover?: Unit,
): void {
  const instances = unit.statuses.filter(
    (s) => s.id === statusId && (!sourceId || s.sourceId === sourceId),
  );
  for (const inst of instances) {
    if (!unit.statuses.includes(inst)) continue;
    if (inst.attrMods.maxHp) {
      unit.attrs.maxHp = Math.max(
        MIN_MAX_HP,
        unit.attrs.maxHp - inst.attrMods.maxHp,
      );
      unit.wound = Math.min(unit.wound, unit.attrs.maxHp - 1);
      const hpBefore = unit.attrs.hp;
      if (unit.attrs.hp > recoverableHp(unit))
        unit.attrs.hp = recoverableHp(unit);
      recordHpLoss(ctx, unit, hpBefore - unit.attrs.hp);
    }
    unit.statuses = unit.statuses.filter((s) => s !== inst);
    const def = ctx.statusDefs.get(inst.id);
    ctx.emit({
      type: EventType.StatusRemoved,
      unitId: unit.id,
      statusId,
      reason,
      ...(def?.sourceBound ? { sourceId: inst.sourceId } : {}),
    });
    ctx.hooks.emit(HookName.OnStatusRemoved, {
      source: ctx.state.units.find((u) => u.id === inst.sourceId),
      target: unit,
      removedStatusKind: inst.kind,
      removedStatusId: inst.id,
      removedStatusSourceId: inst.sourceId,
      removedStatusRounds: inst.remainingRounds,
      removedStatusSkillLevel: inst.appliedSkillLevel ?? inst.tickSkillLevel ?? inst.transitionSkillLevel ?? 0,
      removedStatusCategory: def?.category,
      removedStatusDispellable: def?.dispellable !== false,
      removedStatusWasSeal: def?.isSeal === true,
      removedStatusFlags: Object.values(StatusFlag).filter(flag => def?.[flag] === true),
      statusRemovedByAlly: remover ? remover.side === unit.side : false,
      statusRemoveReason: reason,
    });
  }
}

export function breakStatusesOnDamage(ctx: BattleContext, unit: Unit, hpDamage = 1): void {
  const broken = unit.statuses.filter(
    (s) => {
      const def = ctx.statusDefs.get(s.id);
      return def?.breakOnDamage && hpDamage > (def.breakOnDamageAbove ?? 0);
    },
  );
  for (const s of broken)
    removeStatus(ctx, unit, s.id, StatusRemoveReason.Damage, s.sourceId);
}

/** 倒地清异常；persistWhenDowned（锢魂）留下。 */
export function clearCombatStatuses(ctx: BattleContext, unit: Unit): void {
  for (const inst of [...unit.statuses]) {
    if (ctx.statusDefs.get(inst.id)?.persistWhenDowned) continue;
    removeStatus(ctx, unit, inst.id, StatusRemoveReason.Downed, inst.sourceId);
  }
}
