import { combatModifiers, modifierValue } from './modifiers';
import { applyEntryStatuses } from "./status.ts"
/**
 * 单次出手结算。按指令类型派发，避免 resolveAction 堆叠成长方法。
 * 这里不出现门派/技能 id 分支。
 */
import { clearBarriers } from './barriers.ts';
import {
  fillMissingCommand,
  isUnsupported,
  rememberCommand,
} from './commands.ts';
import { BUILTIN_SKILL_ID, MIN_HP, NORMAL_ATTACK_COEFF } from './constants.ts';
import type { BattleContext } from './context.ts';
import { resolveAliveTarget, resolveStrike } from './damage.ts';
import { applyEffect, makeEnv } from './effects.ts';
import {
  CommandPolicy,
  CommandType,
  DamageKind,
  EffectType,
  EventType,
  failDetail,
  FailReason,
  HookName,
  oppositeSide,
  ResultReason,
  SkillTag,
  SkipReason,
  StatusFlag,
  StatusRemoveReason,
  UnitKind,
} from './enums.ts';
import { evalExpr } from './expr.ts';
import { atLeast } from './math.ts';
import { standingUnits } from './query.ts';
import { checkSkillRequirements } from './requirements.ts';
import { skillOf } from './skills.ts';
import {
  commandBlockReason,
  commandPolicyOf,
  hasBlock,
  hasStatusFlag,
  removeStatus,
} from './status.ts';
import { resolveSkillTargets } from './targeting.ts';
import type { Command, SkillDef, Unit } from './types.ts';
import {
  canCollectCommand,
  effectiveSpeed,
  isActionable,
  isStanding,
  resourceOf,
} from './units.ts';
import { consumeWhen, matchesWhen, targetStatusStacks } from './when.ts';

/** 防御/保护在锁指令时立刻生效，不必等该单位出手（保护者比被保护者慢时仍能拦刀）。 */
export function applyRoundFlags(unit: Unit, command: Command): void {
  unit.flags.defending = command.type === CommandType.Defend;
  unit.flags.protecting =
    command.type === CommandType.Protect ? command.target : undefined;
}

export function clearRoundFlags(unit: Unit): void {
  unit.flags.defending = false;
  unit.flags.protecting = undefined;
  unit.command = undefined;
}

/** 当回合速度（含状态加减）排序；后发制人一类 actFirst 插到队列最前。合击未实现。 */
export function turnOrder(ctx: BattleContext): Unit[] {
  return ctx.state.units
    .filter((unit) => canCollectCommand(unit, ctx.rules.deferredPlayerCommands))
    .slice()
    .sort((a, b) => {
      const first =
        Number(hasStatusFlag(ctx, a, StatusFlag.ActFirst)) -
        Number(hasStatusFlag(ctx, b, StatusFlag.ActFirst));
      if (first !== 0) return -first;
      const ds = effectiveSpeed(b) - effectiveSpeed(a);
      if (ds !== 0) return ds;
      if (a.side !== b.side) return a.side - b.side;
      return a.slot - b.slot;
    });
}

/** 未提交的单位在此补指令（超时普攻 / 自动复用 / NPC AI），并点亮防御、保护旗。 */
export function lockCommands(ctx: BattleContext): void {
  for (const unit of ctx.state.units.filter((unit) =>
    canCollectCommand(unit, ctx.rules.deferredPlayerCommands),
  )) {
    let command = unit.command;
    if (!command) {
      command = fillMissingCommand(ctx, unit);
      rememberCommand(unit, command);
      ctx.emit({ type: EventType.CommandDefaulted, unitId: unit.id, command });
    }
    if (!commandBlockReason(ctx, unit, command)) applyRoundFlags(unit, command);
  }
}

export function resolveAction(ctx: BattleContext, unit: Unit): void {
  if (!isActionable(unit)) return;

  // 横扫等「休息一回合」：跳过的是下一回合，不是当回合剩余出手。
  if (unit.flags.skipNextAction) {
    unit.flags.skipNextAction = false;
    ctx.emit({
      type: EventType.ActionSkip,
      unitId: unit.id,
      reason: SkipReason.Rest,
    });
    return;
  }

  if (hasBlock(ctx, unit, StatusFlag.BlocksAction)) {
    ctx.emit({
      type: EventType.ActionSkip,
      unitId: unit.id,
      reason: SkipReason.Status,
    });
    return;
  }

  applyCommandPolicy(ctx, unit);

  const skip = ctx.hooks.emit(HookName.BeforeAction, { source: unit });
  if (skip.cancelled) {
    ctx.emit({
      type: EventType.ActionSkip,
      unitId: unit.id,
      reason: SkipReason.Hook,
    });
    return;
  }

  const command = unit.command;
  if (!command) {
    ctx.emit({
      type: EventType.ActionSkip,
      unitId: unit.id,
      reason: SkipReason.NoCommand,
    });
    return;
  }

  const restriction = commandBlockReason(ctx, unit, command);
  if (restriction) {
    unit.flags.defending = false;
    unit.flags.protecting = undefined;
    ctx.emit({ type: EventType.ActionFailed, unitId: unit.id, reason: restriction });
    return;
  }

  if (
    command.type === CommandType.Defend ||
    command.type === CommandType.Protect
  ) {
    ctx.emit({ type: EventType.ActionStart, unitId: unit.id, command });
    return;
  }

  if (isUnsupported(command)) {
    ctx.emit({
      type: EventType.ActionFailed,
      unitId: unit.id,
      reason: failDetail(FailReason.Unsupported, command.type),
    });
    return;
  }

  const handler = commandHandlers[command.type];
  handler?.(ctx, unit, command);
}

const commandHandlers: Partial<
  Record<
    Command['type'],
    (ctx: BattleContext, unit: Unit, command: Command) => void
  >
> = {
  flee: (ctx, unit) => {
    ctx.emit({
      type: EventType.ActionStart,
      unitId: unit.id,
      command: { type: CommandType.Flee },
    });
    resolveFlee(ctx, unit);
  },
  summon: (ctx, unit, command) => {
    if (command.type !== CommandType.Summon) return;
    ctx.emit({ type: EventType.ActionStart, unitId: unit.id, command });
    resolveSummon(ctx, unit, command.petId);
  },
  recall: (ctx, unit) => {
    ctx.emit({
      type: EventType.ActionStart,
      unitId: unit.id,
      command: { type: CommandType.Recall },
    });
    for (const pet of ctx.state.units)
      if (
        pet.kind === UnitKind.Pet &&
        pet.ownerId === unit.id &&
        isStanding(pet)
      )
        recallPet(ctx, unit, pet);
  },
  skill: (ctx, unit, command) => {
    if (command.type !== CommandType.Skill) return;
    resolveSkillCommand(ctx, unit, command.skillId, command.targets);
  },
  attack: (ctx, unit, command) => {
    if (command.type !== CommandType.Attack) return;
    if (hasBlock(ctx, unit, StatusFlag.BlocksPhysical)) {
      ctx.emit({
        type: EventType.ActionFailed,
        unitId: unit.id,
        reason: FailReason.Rooted,
      });
      return;
    }
    resolvePhysicalAttack(
      ctx,
      unit,
      command.target,
      (commandPolicyOf(ctx, unit).policy === CommandPolicy.RandomAttackTarget || commandPolicyOf(ctx, unit).policy === CommandPolicy.RandomNormalAttackTarget),
    );
  },
};

/** 后发：强制普攻锁定目标并抢先；混乱：随机打场上存活单位（含队友）。 */
function applyCommandPolicy(ctx: BattleContext, unit: Unit): void {
  const { policy, storedTargetId } = commandPolicyOf(ctx, unit);
  if (policy === CommandPolicy.StoredAttack) {
    const target = resolveAliveTarget(
      ctx,
      unit,
      storedTargetId ?? unit.lastTargetId,
    );
    if (target) {
      unit.command = { type: CommandType.Attack, target: target.id };
      unit.lastTargetId = target.id;
    }
    return;
  }
  if (policy === CommandPolicy.Random) {
    const pool = randomAttackPool(ctx, unit);
    if (pool.length === 0) return;
    const pick = pool[Math.floor(ctx.rng.next() * pool.length)];
    unit.command = { type: CommandType.Attack, target: pick.id };
    return;
  }
  if (policy === CommandPolicy.RandomAttackTarget || policy === CommandPolicy.RandomNormalAttackTarget) {
    const command = unit.command;
    const physical =
      command?.type === CommandType.Attack ||
      (policy === CommandPolicy.RandomAttackTarget && command?.type === CommandType.Skill &&
        Boolean(
          skillOf(ctx.skills, unit, command.skillId)?.tags.includes(
            SkillTag.Physical,
          ),
        ));
    if (!physical) return;
    const pool = randomAttackPool(ctx, unit);
    if (pool.length === 0) return;
    const pick = pool[Math.floor(ctx.rng.next() * pool.length)];
    unit.lastTargetId = pick.id;
    unit.command =
      command.type === CommandType.Attack
        ? { ...command, target: pick.id }
        : {
            ...command,
            targets: [
              pick.id,
              ...command.targets.filter((id) => id !== pick.id),
            ],
          };
  }
}

function randomAttackPool(ctx: BattleContext, unit: Unit): Unit[] {
  return ctx.state.units
    .filter((candidate) => candidate.id !== unit.id && isStanding(candidate))
    .sort((a, b) => a.slot - b.slot || a.id.localeCompare(b.id));
}

function pickRandomAttackTarget(
  ctx: BattleContext,
  unit: Unit,
): Unit | undefined {
  const pool = randomAttackPool(ctx, unit);
  return pool.length > 0
    ? pool[Math.floor(ctx.rng.next() * pool.length)]
    : undefined;
}

function resolvePhysicalAttack(
  ctx: BattleContext,
  unit: Unit,
  targetId: string,
  allowAlly = false,
): void {
  const direct = ctx.state.units.find((candidate) => candidate.id === targetId);
  const target =
    allowAlly && direct && direct.id !== unit.id && isStanding(direct)
      ? direct
      : resolveAliveTarget(ctx, unit, targetId);
  if (!target) {
    ctx.emit({
      type: EventType.ActionFailed,
      unitId: unit.id,
      reason: FailReason.NoTarget,
    });
    return;
  }
  ctx.currentAction = {
    normalTargetIds: [target.id],
    initialOwnedStatusKindsByTarget: Object.fromEntries(ctx.state.units.map(target => [target.id, target.statuses.filter(s => s.sourceId === unit.id).map(s => s.kind)])),
    initialSourceStatusIds: unit.statuses.map(s => s.id),
    skillId: BUILTIN_SKILL_ID.Attack,
    sourceId: unit.id,
    primaryTargetId: target.id,
    targetIds: [target.id],
    resourceGains: {},
    hpRestoreGains: {},
    impactDamageByTarget: {},
    initialStatusIdsByTarget: {
      [target.id]: target.statuses.map((status) => status.id),
    },
    initialStatusKindsByTarget: {
      [target.id]: target.statuses.map((status) => status.kind),
    },
    failed: false,
  };
  ctx.emit({
    type: EventType.ActionStart,
    unitId: unit.id,
    command: { type: CommandType.Attack, target: target.id },
  });
  resolveStrike(ctx, {
    source: unit,
    target,
    kind: DamageKind.Physical,
    coeff: NORMAL_ATTACK_COEFF,
    power: 0,
    skillId: BUILTIN_SKILL_ID.Attack,
    isPrimary: true,
  });
  ctx.hooks.emit(HookName.AfterAction, {
    source: unit,
    target,
    skillId: BUILTIN_SKILL_ID.Attack,
    kind: DamageKind.Physical,
    isPrimary: true,
  });
  ctx.currentAction = undefined;
}

/** 替换出战宠：场上同主人宠收回板凳；死亡宠不能再召。 */
function resolveSummon(ctx: BattleContext, unit: Unit, petId: string): void {
  const pet = ctx.state.units.find((u) => u.id === petId);
  if (!pet || pet.kind !== UnitKind.Pet || pet.ownerId !== unit.id) {
    ctx.emit({
      type: EventType.ActionFailed,
      unitId: unit.id,
      reason: FailReason.SummonInvalid,
    });
    return;
  }
  if (pet.flags.dead) {
    ctx.emit({
      type: EventType.ActionFailed,
      unitId: unit.id,
      reason: FailReason.SummonDead,
    });
    return;
  }
  if (isStanding(pet)) {
    ctx.emit({
      type: EventType.ActionFailed,
      unitId: unit.id,
      reason: FailReason.SummonAlreadyOut,
    });
    return;
  }
  for (const other of ctx.state.units) {
    if (
      other.kind === UnitKind.Pet &&
      other.ownerId === unit.id &&
      !other.flags.benched
    ) {
      recallPet(ctx, unit, other);
    }
  }
  pet.flags.benched = false;
  applyEntryStatuses(ctx, pet);
  ctx.emit({ type: EventType.PetSummoned, unitId: unit.id, petId: pet.id });
}

function recallPet(ctx: BattleContext, owner: Unit, pet: Unit): void {
  pet.flags.benched = true;
  pet.flags.reviveAtRound = undefined;
  clearRoundFlags(pet);
  for (const status of [...pet.statuses])
    if (!ctx.statusDefs.get(status.id)?.persistWhenBenched)
      removeStatus(ctx, pet, status.id, StatusRemoveReason.Recalled);
  clearBarriers(ctx, pet);
  ctx.emit({ type: EventType.PetRecalled, unitId: owner.id, petId: pet.id });
}

function resolveFlee(ctx: BattleContext, unit: Unit): void {
  const chance = ctx.rules.formulas.fleeChance(
    unit,
    standingUnits(ctx.state, oppositeSide(unit.side)),
  );
  if (!ctx.rng.chance(chance)) {
    ctx.emit({
      type: EventType.ActionFailed,
      unitId: unit.id,
      reason: FailReason.FleeFailed,
    });
    return;
  }
  unit.flags.escaped = true;
  unit.command = undefined;
  ctx.emit({ type: EventType.UnitEscaped, unitId: unit.id });
  for (const pet of ctx.state.units) {
    if (pet.kind !== UnitKind.Pet || pet.ownerId !== unit.id || pet.flags.dead)
      continue;
    pet.flags.escaped = true;
    pet.command = undefined;
    ctx.emit({ type: EventType.UnitEscaped, unitId: pet.id });
  }
  ctx.checkEnd(ResultReason.Flee);
}

function resolveSkillCommand(
  ctx: BattleContext,
  unit: Unit,
  skillId: string,
  targets: string[],
): void {
  const skill = skillOf(ctx.skills, unit, skillId);
  if (!skill) {
    ctx.emit({
      type: EventType.ActionFailed,
      unitId: unit.id,
      reason: failDetail(FailReason.UnknownSkill, skillId),
    });
    return;
  }
  if (skill.tags.includes(SkillTag.Passive)) {
    ctx.emit({
      type: EventType.ActionFailed,
      unitId: unit.id,
      reason: FailReason.PassiveNotCastable,
    });
    return;
  }
  // 失心等封法：法术失败，未同时封物则转普通攻击。
  if (
    skill.tags.includes(SkillTag.Spell) &&
    !skill.tags.includes(SkillTag.Art) &&
    hasBlock(ctx, unit, StatusFlag.BlocksSpell)
  ) {
    ctx.emit({
      type: EventType.ActionFailed,
      unitId: unit.id,
      reason: FailReason.Sealed,
    });
    if (!hasBlock(ctx, unit, StatusFlag.BlocksPhysical) && !commandBlockReason(ctx, unit, { type: CommandType.Attack, target: targets[0] ?? "" })) {
      const randomTarget =
        commandPolicyOf(ctx, unit).policy === CommandPolicy.RandomNormalAttackTarget
          ? pickRandomAttackTarget(ctx, unit)
          : commandPolicyOf(ctx, unit).policy === CommandPolicy.RandomAttackTarget
          ? skill.tags.includes(SkillTag.Physical)
            ? ctx.state.units.find(
                (candidate) =>
                  candidate.id === unit.lastTargetId &&
                  candidate.id !== unit.id &&
                  isStanding(candidate),
              )
            : pickRandomAttackTarget(ctx, unit)
          : undefined;
      const fallback =
        randomTarget ?? resolveAliveTarget(ctx, unit, unit.lastTargetId);
      if (fallback)
        resolvePhysicalAttack(ctx, unit, fallback.id, Boolean(randomTarget));
    }
    return;
  }
  if (
    skill.tags.includes(SkillTag.Physical) &&
    hasBlock(ctx, unit, StatusFlag.BlocksPhysical)
  ) {
    ctx.emit({
      type: EventType.ActionFailed,
      unitId: unit.id,
      reason: FailReason.Rooted,
    });
    return;
  }
  resolveSkill(
    ctx,
    unit,
    skill,
    targets,
    commandPolicyOf(ctx, unit).policy === CommandPolicy.RandomAttackTarget &&
      skill.tags.includes(SkillTag.Physical)
      ? targets[0]
      : undefined,
  );
}

function resolveSkill(
  ctx: BattleContext,
  unit: Unit,
  skill: SkillDef,
  targetIds: string[],
  forcedPrimaryId?: string,
): void {
  if (!unit.skills.includes(skill.id) && !unit.passives.includes(skill.id)) {
    ctx.emit({
      type: EventType.ActionFailed,
      unitId: unit.id,
      reason: FailReason.SkillNotKnown,
    });
    return;
  }

  const normalTargetIds: string[] = [];
  const targets = resolveSkillTargets(
    ctx,
    unit,
    skill,
    targetIds,
    forcedPrimaryId,
    normalTargetIds,
  );
  const env = makeEnv(unit, skill, targets);
  const { mpCost, hpCost, resourceCosts, reasons } = checkSkillRequirements(
    ctx,
    unit,
    skill,
    targets,
  );

  if (targets.length === 0) {
    if (skill.capture || skill.targeting.requireRevivable || skill.targeting.requireKind) {
      ctx.emit({
        type: EventType.ActionFailed,
        unitId: unit.id,
        reason: FailReason.NoTarget,
      });
      return;
    }
    fallbackToAttack(ctx, unit, targetIds, FailReason.NoTarget);
    return;
  }

  if (reasons.includes('cooldown')) {
    ctx.emit({ type: EventType.ActionFailed, unitId: unit.id, reason: 'cooldown' });
    return;
  }
  if (reasons.includes('skill-condition')) {
    ctx.emit({ type: EventType.ActionFailed, unitId: unit.id, reason: 'skill-condition' });
    return;
  }
  if (reasons.includes(FailReason.HpRequirement)) {
    if (skill.requireHpRatio !== undefined) fallbackToAttack(ctx, unit, targetIds, FailReason.HpRequirement);
    else ctx.emit({ type: EventType.ActionFailed, unitId: unit.id, reason: FailReason.HpRequirement });
    return;
  }
  if (skill.forbidRevivedRound && unit.flags.revivedRound === ctx.state.round) {
    ctx.emit({ type: EventType.ActionFailed, unitId: unit.id, reason: FailReason.RevivedThisRound });
    return;
  }
  const missingResource = skill.resourceRequirements?.find(
    (requirement) =>
      (resourceOf(unit, requirement.resourceId)?.current ?? 0) <
      requirement.min,
  );
  if (missingResource) {
    fallbackToAttack(
      ctx,
      unit,
      targetIds,
      failDetail(FailReason.ResourceRequirement, missingResource.resourceId),
    );
    return;
  }
  const missingCost = resourceCosts.find(
    (cost) => (resourceOf(unit, cost.resourceId)?.current ?? 0) < cost.amount,
  );
  if (missingCost) {
    fallbackToAttack(
      ctx,
      unit,
      targetIds,
      failDetail(FailReason.ResourceRequirement, missingCost.resourceId),
    );
    return;
  }
  if (unit.attrs.mp < mpCost) {
    if (skill.capture || skill.targeting.requireRevivable || skill.targeting.requireKind) {
      ctx.emit({
        type: EventType.ActionFailed,
        unitId: unit.id,
        reason: FailReason.InsufficientMp,
      });
      return;
    }
    fallbackToAttack(ctx, unit, targetIds, FailReason.InsufficientMp);
    return;
  }

  ctx.currentAction = {
    normalTargetIds,
    initialOwnedStatusKindsByTarget: Object.fromEntries(ctx.state.units.map(target => [target.id, target.statuses.filter(s => s.sourceId === unit.id).map(s => s.kind)])),
    initialSourceStatusIds: unit.statuses.map(s => s.id),
    initialHpRatio: unit.attrs.hp / unit.attrs.maxHp,
    killedTargetIds: [],
    skillId: skill.id,
    sourceId: unit.id,
    primaryTargetId: targets[0]?.id,
    targetIds: targets.map((t) => t.id),
    resourceGains: {},
    hpRestoreGains: {},
    impactDamageByTarget: {},
    initialStatusIdsByTarget: Object.fromEntries(
      targets.map((target) => [
        target.id,
        target.statuses.map((status) => status.id),
      ]),
    ),
    initialStatusKindsByTarget: Object.fromEntries(
      targets.map((target) => [
        target.id,
        target.statuses.map((status) => status.kind),
      ]),
    ),
    failed: false,
  };
  // 本次行动同步结算；准备阶段完成后，再把日志里的目标列表收束为实际出手名单。
  const actionCommand: Command = { type: CommandType.Skill, skillId: skill.id, targets: targets.map(t => t.id) };
  ctx.emit({ type: EventType.ActionStart, unitId: unit.id, command: actionCommand });

  let settledMpCost = mpCost;
  if (skill.preparation) {
    applyDeclaredEffects(ctx, unit, skill, skill.preparation.effects, targets, targetIds, env);
    const count = Math.max(1, Math.floor(evalExpr(skill.preparation.targetCount, { ...env, state: ctx.state })));
    targets.splice(count);
    normalTargetIds.splice(count);
    env.targets = targets.length;
    ctx.currentAction.targetIds = targets.map(t => t.id);
    actionCommand.targets = [...ctx.currentAction.targetIds];
    // 准备阶段只缩小候选集合，预检的最高标价保证不会在自损后才发现蓝不足。
    settledMpCost = checkSkillRequirements(ctx, unit, skill, targets).mpCost;
  }

  const waiverChance = skill.capture ? 0 : Math.max(0, ...unit.passives.map(
    (id) => skillOf(ctx.skills, unit, id)?.innate?.mpCostWaiverChance ?? 0,
  ));
  const waiveMp = settledMpCost > 0 && waiverChance > 0 && ctx.rng.chance(waiverChance);
  if (settledMpCost > 0 && !waiveMp) {
    unit.attrs.mp -= settledMpCost;
    ctx.emit({
      type: EventType.MpCost,
      unitId: unit.id,
      amount: settledMpCost,
      mpAfter: unit.attrs.mp,
    });
  }
  if (hpCost > 0) {
    // 横扫耗血不会把自己打到 0。
    const spend = Math.min(atLeast(0, unit.attrs.hp - MIN_HP), hpCost);
    unit.attrs.hp -= spend;
    ctx.emit({
      type: EventType.HpCost,
      unitId: unit.id,
      amount: spend,
      hpAfter: unit.attrs.hp,
    });
  }
  for (const cost of resourceCosts) {
    if (cost.amount <= 0) continue;
    const resource = resourceOf(unit, cost.resourceId)!;
    const before = resource.current;
    resource.current -= cost.amount;
    ctx.emit({
      type: EventType.ResourceChanged,
      sourceId: unit.id,
      unitId: unit.id,
      resourceId: resource.id,
      before,
      after: resource.current,
    });
  }

  if (skill.capture) {
    const target = targets[0]!;
    const chance = Math.max(
      0,
      Math.min(1, evalExpr(skill.capture.chance, env)),
    );
    const success = ctx.rng.chance(chance);
    ctx.emit({
      type: EventType.ChanceResolved,
      branchId: skill.id,
      sourceId: unit.id,
      targetId: target.id,
      chance,
      success,
    });
    if (success) {
      target.flags.benched = true;
      target.flags.capturedBy = unit.id;
      clearRoundFlags(target);
      ctx.emit({
        type: EventType.UnitCaptured,
        unitId: unit.id,
        targetId: target.id,
        generationSeed: Math.floor(ctx.rng.next() * 0x7fffffff),
      });
      ctx.checkEnd();
    } else {
      ctx.emit({
        type: EventType.ActionFailed,
        unitId: unit.id,
        reason: FailReason.CaptureFailed,
      });
    }
  }
  applyDeclaredEffects(
    ctx,
    unit,
    skill,
    skill.preparation && !isStanding(unit) ? [] : skill.effects,
    targets,
    targetIds,
    env,
  );
  if (!ctx.currentAction.failed && skill.successEffects?.length) {
    applyDeclaredEffects(
      ctx,
      unit,
      skill,
      skill.successEffects,
      targets,
      targetIds,
      env,
    );
  }
  if (!ctx.currentAction.failed && isStanding(unit) && (skill.successCostHp !== undefined || skill.successCostMp !== undefined)) {
    const costEnv = { ...env, source: unit };
    const hp = Math.min(Math.max(0, unit.attrs.hp - MIN_HP), Math.max(0, Math.floor(evalExpr(skill.successCostHp, costEnv))));
    const mp = Math.min(unit.attrs.mp, Math.max(0, Math.floor(evalExpr(skill.successCostMp, costEnv))));
    if (hp > 0) {
      unit.attrs.hp -= hp;
      ctx.emit({ type: EventType.HpCost, unitId: unit.id, amount: hp, hpAfter: unit.attrs.hp });
    }
    if (mp > 0) {
      unit.attrs.mp -= mp;
      ctx.emit({ type: EventType.MpCost, unitId: unit.id, amount: mp, mpAfter: unit.attrs.mp });
    }
  }
  // Repeat only a direct damaging spell; do not repeat utility effects or costs.
  if (!ctx.currentAction.failed && isStanding(unit) && !ctx.state.result &&
      skill.tags.includes(SkillTag.Spell) && skill.effects.length > 0 &&
      skill.effects.every(effect => effect.type === EffectType.SpellHit && !effect.targeting)) {
    for (const passiveId of unit.passives) {
      const passive = skillOf(ctx.skills, unit, passiveId);
      const repeat = passive?.innate?.spellRepeat;
      if (!repeat) continue;
      if (targets.some(isStanding) && ctx.rng.chance(repeat.chance)) {
        ctx.emit({ type: EventType.MechanicTriggered, mechanicId: passiveId, name: passive!.name, sourceId: unit.id, targetId: targets[0]?.id });
        ctx.currentAction.spellRepeatFactor = repeat.factor;
        applyDeclaredEffects(ctx, unit, skill, skill.effects, targets, targetIds, env);
        ctx.currentAction.spellRepeatFactor = undefined;
      }
      break;
    }
  }
  const kind = skill.tags.includes(SkillTag.Physical)
    ? DamageKind.Physical
    : skill.tags.includes(SkillTag.Spell)
      ? DamageKind.Spell
      : undefined;
  if (!ctx.currentAction.failed) {
    const modifiers = combatModifiers(ctx, unit, { skill, skillId: skill.id, target: targets[0], kind });
    if (skill.cooldownRounds && !(ctx.currentAction.killedTargetIds?.length && modifiers.some(m => m.resetCooldownOnKill))) {
      (unit.cooldowns ??= {})[skill.id] = ctx.state.round + skill.cooldownRounds;
    }
    const skipChance = modifierValue(modifiers, 'recoverySkipChance', unit, targets[0], skill);
    if (skill.recoveryStatusId && skipChance > 0) {
      const chance = Math.min(1, skipChance);
      const success = ctx.rng.chance(chance);
      ctx.emit({ type: EventType.ChanceResolved, branchId: `${skill.id}.recovery`, sourceId: unit.id, chance, success });
      if (success) {
        unit.flags.skipNextAction = false;
        removeStatus(ctx, unit, skill.recoveryStatusId, StatusRemoveReason.Consumed);
      }
    }
  }
  ctx.hooks.emit(HookName.AfterAction, {
    source: unit,
    target: targets[0],
    skillId: skill.id,
    kind,
    isPrimary: true,
  });
  if (!ctx.currentAction.failed) (unit.skillUses ??= {})[skill.id] = (unit.skillUses?.[skill.id] ?? 0) + 1;
  ctx.currentAction = undefined;
}

function applyDeclaredEffects(
  ctx: BattleContext,
  unit: Unit,
  skill: SkillDef,
  effects: SkillDef['effects'],
  targets: Unit[],
  targetIds: string[],
  env: ReturnType<typeof makeEnv>,
): void {
  for (const effect of effects) {
    // 战斗已结束后不再产生伤害/状态，但仍结清本次技能声明的资源变化。
    if (
      ctx.state.result &&
      !new Set<string>([
        EffectType.ModifyResource,
        EffectType.Heal,
        EffectType.RestoreHp,
        EffectType.RestoreMp,
        EffectType.RemoveWound,
        EffectType.ApplyBarrier,
        EffectType.EmitMechanic,
      ]).has(effect.type)
    )
      continue;
    const resolvedTargets = effect.targeting
      ? resolveSkillTargets(
          ctx,
          unit,
          { ...skill, targeting: effect.targeting },
          targetIds,
        )
      : targets;
    const effectTargets = effect.when
      ? resolvedTargets.filter((target) =>
          matchesWhen(ctx, effect.when, {
            source: unit,
            target,
            skill,
            skillId: skill.id,
            markKey: `${skill.id}:effect`,
          }),
        )
      : resolvedTargets;
    if (resolvedTargets.length > 0 && effectTargets.length === 0) {
      continue;
    }
    if (effect.targeting) {
      for (const target of effectTargets) {
        applyEffect(ctx, unit, skill, effect, [target], {
          ...makeEnv(unit, skill, effectTargets),
          target,
          targetStatusStacks: targetStatusStacks(ctx, effect.when, target),
        });
      }
    } else {
      const target = effectTargets[0] ?? env.target;
      applyEffect(ctx, unit, skill, effect, effectTargets, {
        ...env,
        target,
        targetStatusStacks: targetStatusStacks(ctx, effect.when, target),
      });
    }
    env.damage = ctx.lastStrikeDamage;
    const envTarget = effectTargets[0] ?? env.target;
    env.impactDamage = envTarget
      ? (ctx.currentAction?.impactDamageByTarget[envTarget.id] ?? 0)
      : 0;
    consumeWhen(ctx, effect.when, {
      source: unit,
      target: effectTargets[0],
      skill,
      skillId: skill.id,
      markKey: `${skill.id}:effect`,
    });
  }
}

/** 蓝不足、横扫气血未过半等：技能失败后改打普攻（端游常见兜底）。 */
function fallbackToAttack(
  ctx: BattleContext,
  unit: Unit,
  targetIds: string[],
  reason: string,
): void {
  ctx.emit({ type: EventType.ActionFailed, unitId: unit.id, reason });
  if (commandBlockReason(ctx, unit, { type: CommandType.Attack, target: targetIds[0] ?? "" })) return;
  const policy = commandPolicyOf(ctx, unit).policy;
  if (policy === CommandPolicy.RandomAttackTarget || policy === CommandPolicy.RandomNormalAttackTarget) {
    const command = unit.command;
    const target =
      policy === CommandPolicy.RandomAttackTarget && command?.type === CommandType.Skill &&
      skillOf(ctx.skills, unit, command.skillId)?.tags.includes(
        SkillTag.Physical,
      )
        ? ctx.state.units.find(
            (candidate) => candidate.id === (targetIds[0] ?? unit.lastTargetId),
          )
        : pickRandomAttackTarget(ctx, unit);
    if (target && target.id !== unit.id && isStanding(target))
      resolvePhysicalAttack(ctx, unit, target.id, true);
    return;
  }
  const fallback = resolveAliveTarget(
    ctx,
    unit,
    targetIds[0] ?? unit.lastTargetId,
  );
  if (fallback) resolvePhysicalAttack(ctx, unit, fallback.id);
}
