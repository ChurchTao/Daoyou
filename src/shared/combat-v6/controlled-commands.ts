import type {
  BattleState,
  CombatV6CommandOptions,
  Command,
} from '../engine/combat-v6/core';
import { canCollectCommand } from '../engine/combat-v6/core/units';

export function controlledUnits(state: BattleState, ownerId: string) {
  return state.units
    .filter(
      (unit) =>
        (unit.id === ownerId ||
          (unit.kind === 'pet' && unit.ownerId === ownerId)) &&
        canCollectCommand(unit, true),
    )
    .sort((a, b) => Number(b.id === ownerId) - Number(a.id === ownerId));
}

export function validateCommandGroup(
  state: BattleState,
  ownerId: string,
  entries: Array<{ unitId: string; command: Command }>,
) {
  const units = controlledUnits(state, ownerId);
  if (
    entries.length !== units.length ||
    new Set(entries.map((e) => e.unitId)).size !== entries.length ||
    entries.some((e) => !units.some((u) => u.id === e.unitId))
  )
    throw new Error('请提交人物与当前召唤兽的完整指令');
}

export function validatePetCommand(
  options: CombatV6CommandOptions,
  command: Command,
) {
  if (
    command.type === 'summon' &&
    !options.summonablePets?.some((p) => p.id === command.petId)
  )
    throw new Error('当前不能召唤该灵兽');
  if (command.type === 'recall' && !options.canRecall)
    throw new Error('当前不能召回灵兽');
}
