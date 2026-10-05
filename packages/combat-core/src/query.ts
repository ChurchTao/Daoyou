/**
 * 战场查询。standing = 可出手/可被单体选中；板凳宠不算存活，挡不住灭队。
 */
import { alliesOf, enemiesOf, unitById } from './unit-query.js';
import type { BattleContext } from './context.js';
import { BattlePhase, TargetMode } from './enums.js';
import { commandBlockReason } from './status.js';
import { checkSkillRequirements } from './requirements.js';
import { skillOf } from './skills.js';
import { isUntargetableBy, poolFor, targetCount } from './targeting.js';
import type {
  CombatV6CommandOptions,
  Unit,
  UnitId,
} from './types.js';
import { canCollectCommand, isStanding } from './units.js';

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
      targets.slice(0, targetCount(unit, skill, 1, ctx)),
    );
    const skillReasons = canSubmit
      ? check.reasons
      : [...reasons, ...check.reasons];
    return [
      {
        skillId,
        ...((unit.cooldowns?.[skillId] ?? 0) > ctx.state.round ? { cooldownRemaining: unit.cooldowns![skillId] - ctx.state.round } : {}),
        name: skill.name,
        costs: {
          mp: check.mpCost,
          hp: check.hpCost,
          resources: check.resourceCosts,
        },
        ready: ctx.rules.deferredPlayerCommands
          ? canSubmit && targets.length > 0 && !check.reasons.includes('cooldown') && !check.reasons.includes('command-restricted')
          : skillReasons.length === 0,
        reasons: [...new Set(skillReasons)],
        selectableTargetIds: targets.map((target) => target.id),
        targetMode: skill.targeting.mode ?? TargetMode.Explicit,
        targetCount: targetCount(unit, skill, 1, ctx),
      },
    ];
  });
  return {
    unitId,
    canSubmit,
    reasons,
    attackTargetIds: (commandBlockReason(ctx, unit, { type: "attack", target: "" }) ? [] : enemies)
      .filter((target) => !isUntargetableBy(ctx, unit, target))
      .map((target) => target.id),
    protectTargetIds: (commandBlockReason(ctx, unit, { type: "protect", target: "" }) ? [] : allies).map((target) => target.id),
    canDefend: canSubmit && !commandBlockReason(ctx, unit, { type: "defend" }),
    canFlee: canSubmit && enemies.length > 0 && !commandBlockReason(ctx, unit, { type: "flee" }),
    summonablePets:
      canSubmit && !commandBlockReason(ctx, unit, { type: 'summon', petId: '' }) && isStanding(unit) && unit.kind === 'player'
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
      canSubmit && !commandBlockReason(ctx, unit, { type: "recall" }) &&
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
export {
  unitById, tryUnit, standingUnits, enemiesOf, alliesOf, firstEnemy, teamWiped, teamFled,
} from './unit-query.js';
