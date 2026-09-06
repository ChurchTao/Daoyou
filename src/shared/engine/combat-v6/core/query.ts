/**
 * 战场查询。standing = 可出手/可被单体选中；板凳宠不算存活，挡不住灭队。
 */
import type { BattleContext } from './context.ts';
import { BattlePhase, TargetMode, oppositeSide } from './enums.ts';
import { checkSkillRequirements } from './requirements.ts';
import { skillOf } from './skills.ts';
import { poolFor, targetCount } from './targeting.ts';
import type {
  BattleState,
  CombatV6CommandOptions,
  Side,
  Unit,
  UnitId,
} from './types.ts';
import { canCollectCommand, isStanding } from './units.ts';

export function unitById(state: BattleState, id: UnitId): Unit {
  const unit = state.units.find((u) => u.id === id);
  if (!unit) throw new Error(`unknown unit: ${id}`);
  return unit;
}

export function tryUnit(state: BattleState, id: UnitId): Unit | undefined {
  return state.units.find((u) => u.id === id);
}

export function standingUnits(state: BattleState, side?: Side): Unit[] {
  return state.units.filter(
    (u) => isStanding(u) && (side === undefined || u.side === side),
  );
}

export function enemiesOf(state: BattleState, unit: Unit): Unit[] {
  return standingUnits(state, oppositeSide(unit.side)).sort(
    (a, b) => a.slot - b.slot,
  );
}

export function alliesOf(state: BattleState, unit: Unit): Unit[] {
  return standingUnits(state, unit.side).sort((a, b) => a.slot - b.slot);
}

export function firstEnemy(state: BattleState, unit: Unit): Unit | undefined {
  return enemiesOf(state, unit)[0];
}

/** UI/Host 只读提示。执行期仍由 action 重新裁定并产生正式失败事件。 */
export function commandOptions(
  ctx: BattleContext,
  unitId: UnitId,
): CombatV6CommandOptions {
  const unit = unitById(ctx.state, unitId);
  const reasons: string[] = [];
  if (ctx.state.phase !== BattlePhase.Command)
    reasons.push('not-command-phase');
  if (!canCollectCommand(unit, ctx.rules.deferredPlayerCommands))
    reasons.push('unit-cannot-act');
  const enemies = enemiesOf(ctx.state, unit).sort(stableUnitOrder);
  const allies = alliesOf(ctx.state, unit)
    .filter((candidate) => candidate.id !== unit.id)
    .sort(stableUnitOrder);
  const canSubmit = reasons.length === 0;
  const skills = unit.skills.flatMap((skillId) => {
    const skill = skillOf(ctx.skills, unit, skillId);
    if (!skill) return [];
    const targets = poolFor(ctx, unit, skill);
    if (ctx.rules.deferredPlayerCommands) {
      // A downed player may be revived before this action, including self buffs.
      const units = ctx.state.units.map((candidate) =>
        candidate.flags.downed && canCollectCommand(candidate, true)
          ? { ...candidate, flags: { ...candidate.flags, downed: false } }
          : candidate,
      );
      const prospective = { ...ctx, state: { ...ctx.state, units } };
      const source = units.find((candidate) => candidate.id === unit.id)!;
      for (const target of poolFor(prospective, source, skill)) {
        if (!targets.some((candidate) => candidate.id === target.id))
          targets.push(unitById(ctx.state, target.id));
      }
    }
    targets.sort(stableUnitOrder);
    const check = checkSkillRequirements(
      ctx,
      unit,
      skill,
      targets.slice(0, targetCount(unit, skill, 1)),
    );
    const skillReasons = canSubmit
      ? check.reasons
      : [...reasons, ...check.reasons];
    return [
      {
        skillId,
        name: skill.name,
        costs: {
          mp: check.mpCost,
          hp: check.hpCost,
          resources: check.resourceCosts,
        },
        ready: ctx.rules.deferredPlayerCommands
          ? canSubmit && targets.length > 0
          : skillReasons.length === 0,
        reasons: [...new Set(skillReasons)],
        selectableTargetIds: targets.map((target) => target.id),
        targetMode: skill.targeting.mode ?? TargetMode.Explicit,
        targetCount: targetCount(unit, skill, 1),
      },
    ];
  });
  return {
    unitId,
    canSubmit,
    reasons,
    attackTargetIds: enemies.map((target) => target.id),
    protectTargetIds: allies.map((target) => target.id),
    canDefend: canSubmit,
    canFlee: canSubmit && enemies.length > 0,
    summonablePets:
      canSubmit && isStanding(unit) && unit.kind === 'player'
        ? ctx.state.units
            .filter(
              (pet) =>
                pet.kind === 'pet' &&
                pet.ownerId === unit.id &&
                pet.flags.benched &&
                !pet.flags.dead &&
                !pet.flags.escaped,
            )
            .map((pet) => ({
              id: pet.id,
              name: pet.name,
              hp: pet.attrs.hp,
              maxHp: pet.attrs.maxHp,
              mp: pet.attrs.mp,
              maxMp: pet.attrs.maxMp,
            }))
        : [],
    canRecall:
      canSubmit &&
      isStanding(unit) &&
      unit.kind === 'player' &&
      ctx.state.units.some(
        (pet) =>
          pet.ownerId === unit.id && pet.kind === 'pet' && isStanding(pet),
      ),
    skills,
  };
}

function stableUnitOrder(a: Unit, b: Unit): number {
  return a.slot - b.slot || a.id.localeCompare(b.id);
}

/** 场上没有可站立单位即为灭队（倒地、死亡、逃跑、未召唤的板凳宠都不算）。 */
export function teamWiped(state: BattleState, side: Side): boolean {
  return standingUnits(state, side).length === 0;
}

export function teamFled(state: BattleState, side: Side): boolean {
  const members = state.units.filter((u) => u.side === side);
  return (
    members.length > 0 &&
    members.every((u) => u.flags.escaped || u.flags.dead || u.flags.downed) &&
    members.some((u) => u.flags.escaped)
  );
}
