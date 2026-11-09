import { type AutoStrategy, type AutoComparison } from '@daoyou/game-domain/combat/auto';
import { injuredAllyTargets, selectableAllyTargets } from '@daoyou/combat-core';
import type { CombatV6SkillCommandOption, SkillDef, StatusDef, Unit } from '@daoyou/combat-core/types';







import type { AutoObservation } from './auto-observation.js';


import type { AutoCandidate } from './auto-utility.js';



export function autoComparison(
  condition: AutoStrategy['rules'][number]['conditions'][number],
): AutoComparison {
  if ('comparison' in condition && condition.comparison)
    return condition.comparison;
  return condition.type === 'selfHpBelow' ||
    condition.type === 'allyHpBelow' ||
    condition.type === 'targetHpBelow' ||
    condition.type === 'enemyHpBelow' ||
    condition.type === 'ownPetHp' ||
    condition.type === 'ownPetMp'
    ? 'lt'
    : condition.type === 'roundNumber' ? 'eq' : 'gte';
}



function compareNumber(value: number, threshold: number, by: AutoComparison) {
  const equal = Math.abs(value - threshold) < 1e-9;
  switch (by) {
    case 'eq':
      return equal;
    case 'lt':
      return value < threshold && !equal;
    case 'lte':
      return value < threshold || equal;
    case 'gt':
      return value > threshold && !equal;
    case 'gte':
      return value > threshold || equal;
  }
}



function standing(unit: AutoObservation['units'][number]) {
  return !unit.flags.dead && !unit.flags.downed && !unit.flags.escaped;
}



/** Ordered rules only select among commands already validated by the engine query. */
export function chooseStrategyCandidate(
  observation: AutoObservation,
  sourceId: string,
  candidates: AutoCandidate[],
  strategy?: AutoStrategy,
  recoveryContext?: {
    source: Unit;
    allies: readonly Unit[];
    skillOptions: readonly CombatV6SkillCommandOption[];
    skills: readonly SkillDef[];
    statusDefs: readonly StatusDef[];
  },
): AutoCandidate | undefined {
  const source = observation.units.find((unit) => unit.id === sourceId);
  if (!source || !strategy) return candidates[0];
  const allies = observation.units.filter((unit) => unit.side === source.side);
  const enemies = observation.units.filter((unit) => unit.side !== source.side);
  const ownPet = allies.find((unit) =>
    unit.kind === 'pet' && unit.ownerId === sourceId && standing(unit));
  const hpPercent = (unit: typeof source) =>
    (100 * unit.attrs.hp) / Math.max(1, unit.attrs.maxHp);
  const hasRecoveryRule = strategy.rules.some(rule => rule.conditions.some(
    condition => condition.type === 'allyHpBelow' && condition.recoverySkillId,
  ));
  const recoverySkills = recoveryContext && hasRecoveryRule
    ? new Map(recoveryContext.skills.map(skill => [skill.id, skill]))
    : undefined;
  const recoveryStatuses = recoveryContext && hasRecoveryRule
    ? new Map(recoveryContext.statusDefs.map(status => [status.id, status]))
    : undefined;
  // Recovery legality uses actual allied statuses, including healing prevention.
  const woundedTeammates = recoveryContext && recoverySkills && recoveryStatuses
    ? injuredAllyTargets(recoveryContext.source, recoveryContext.allies, recoverySkills, recoveryStatuses)
        .filter(unit => unit.kind !== 'pet' && unit.id !== sourceId)
    : [];
  // Preparing a recovery spell needs a clear recipient under lowest-HP targeting.
  const firstRecoveryTarget = recoveryContext && woundedTeammates.length
    ? selectableAllyTargets(recoveryContext.source, recoveryContext.allies, recoverySkills, recoveryStatuses)
        .sort((a, b) => hpPercent(a) - hpPercent(b) || a.slot - b.slot)[0]
    : undefined;
  const matchesStatus = (
    unit: typeof source,
    condition: Extract<
      AutoStrategy['rules'][number]['conditions'][number],
      { type: 'selfStatus' | 'targetStatus' | 'allyStatus' }
    >,
  ) =>
    unit.statuses.some(
      (status) =>
        status.kind === condition.kind &&
        (!condition.statusId || status.id === condition.statusId) &&
        (!('ownedBySelf' in condition) || !condition.ownedBySelf || status.sourceId === sourceId) &&
        (!condition.stacks || compareNumber(status.stacks, condition.stacks.amount, condition.stacks.comparison)) &&
        (!condition.remainingRounds || compareNumber(
          recoveryContext?.statusDefs.find(definition => definition.id === status.id)?.untilBattleEnd
            ? Infinity : status.remainingRounds,
          condition.remainingRounds.amount,
          condition.remainingRounds.comparison,
        )),
    );
  for (const rule of strategy.rules) {
    const targetConditions = rule.conditions.filter(
      (condition) =>
        condition.type === 'targetStatus' || condition.type === 'targetHpBelow',
    );
    const matches = rule.conditions.every((condition) => {
      switch (condition.type) {
        case 'roundNumber':
          return compareNumber(observation.round, condition.round, autoComparison(condition));
        case 'ownPetPresent':
          return Boolean(ownPet) === condition.present;
        case 'ownPetHp':
          return Boolean(ownPet && compareNumber(hpPercent(ownPet), condition.percent, autoComparison(condition)));
        case 'ownPetMp':
          return Boolean(ownPet && compareNumber(
            100 * ownPet.attrs.mp / Math.max(1, ownPet.attrs.maxMp),
            condition.percent,
            autoComparison(condition),
          ));
        case 'selfHpBelow':
          return compareNumber(
            hpPercent(source),
            condition.percent,
            autoComparison(condition),
          );
        case 'allyHpBelow':
          return (condition.recoverySkillId ? woundedTeammates : allies).some(
            (unit) =>
              standing(unit) &&
              compareNumber(
                hpPercent(unit),
                condition.percent,
                autoComparison(condition),
              ),
          );
        case 'enemyHpBelow':
          return enemies.some(
            (unit) =>
              standing(unit) &&
              compareNumber(
                hpPercent(unit),
                condition.percent,
                autoComparison(condition),
              ),
          );
        case 'allyDowned':
          return allies.some((unit) => unit.flags.downed);
        case 'allyStatus':
          return (
            allies.some(
              (unit) => standing(unit) && matchesStatus(unit, condition),
            ) === condition.present
          );
        case 'enemyCountAtLeast':
          return compareNumber(
            enemies.filter(standing).length,
            condition.count,
            autoComparison(condition),
          );
        case 'selfResourceAtLeast':
          return compareNumber(
            source.resources.find(
              (resource) => resource.id === condition.resourceId,
            )?.current ?? 0,
            condition.amount,
            autoComparison(condition),
          );
        case 'selfStatus':
          return matchesStatus(source, condition) === condition.present;
        case 'targetStatus':
        case 'targetHpBelow':
          return true;
      }
    });
    if (!matches) continue;
    const eligible = candidates.flatMap((candidate) => {
      const command = candidate.command;
      if (!(
        (rule.action.type === 'summonNext'
          ? command.type === 'summon'
          : command.type === rule.action.type) &&
        (command.type !== 'skill' ||
          (rule.action.type === 'skill' &&
            command.skillId === rule.action.skillId))
      ))
        return [];
      for (const condition of rule.conditions) {
        if (condition.type !== 'allyHpBelow' || !condition.recoverySkillId) continue;
        if (command.type !== 'skill' || !recoveryContext) return [];
        if (command.skillId === condition.recoverySkillId) {
          const reachesWoundedTeammate = candidate.intents.some(intent =>
            intent.healing > 0 && woundedTeammates.some(unit => unit.id === intent.targetId &&
              compareNumber(hpPercent(unit), condition.percent, autoComparison(condition))),
          );
          if (!reachesWoundedTeammate) return [];
        } else {
          const setup = recoveryContext.skillOptions.find(option => option.skillId === command.skillId);
          const recovery = recoveryContext.skillOptions.find(option => option.skillId === condition.recoverySkillId);
          // Reserve both currently quoted MP costs before committing a turn to setup.
          if (!firstRecoveryTarget || !woundedTeammates.includes(firstRecoveryTarget) ||
            !compareNumber(hpPercent(firstRecoveryTarget), condition.percent, autoComparison(condition)) ||
            !setup || !recovery?.ready || recovery.reasons.length ||
            source.attrs.mp < setup.costs.mp + recovery.costs.mp) return [];
        }
      }
      const targetIds =
        command.type === 'attack'
          ? [command.target]
          : command.type === 'skill'
            ? command.targets
            : [];
      if (
        rule.targetScope &&
        rule.targetScope !== 'any' &&
        (!targetIds.length ||
          targetIds.some((id) => {
            const target = observation.units.find((unit) => unit.id === id);
            if (!target || target.side !== source.side) return true;
            if (rule.targetScope === 'allyPet') return target.kind !== 'pet';
            if (rule.targetScope === 'ownPet')
              return target.kind !== 'pet' || target.ownerId !== sourceId;
            return target.kind !== 'player' || target.id === sourceId;
          }))
      )
        return [];
      const matchingTargets = targetConditions.length
        ? targetIds.filter((id) => {
            const target = observation.units.find((unit) => unit.id === id);
            return (
              target &&
              targetConditions.every((condition) =>
                condition.type === 'targetHpBelow'
                  ? compareNumber(
                      hpPercent(target),
                      condition.percent,
                      autoComparison(condition),
                    )
                  : matchesStatus(target, condition) === condition.present,
              )
            );
          })
        : targetIds;
      return !targetConditions.length || matchingTargets.length
        ? [{ candidate, matchingTargets }]
        : [];
    });
    if (!eligible.length) continue;
    if (rule.action.type === 'summonNext' || rule.action.type === 'defend')
      return eligible[0].candidate;
    if (rule.target === 'best') return eligible[0].candidate;
    const desiredSide =
      rule.target === 'lowestHpAlly' ? source.side : 1 - source.side;
    const target = observation.units
      .filter(
        (unit) =>
          unit.side === desiredSide &&
          eligible.some(({ matchingTargets }) => matchingTargets.includes(unit.id)),
      )
      .sort((a, b) => hpPercent(a) - hpPercent(b) || a.slot - b.slot)[0];
    const targeted = eligible.find(({ matchingTargets }) =>
      matchingTargets.includes(target?.id ?? ''),
    );
    if (targeted) return targeted.candidate;
  }
  const scopedSkillIds = new Set(
    strategy.rules.flatMap((rule) =>
      rule.action.type === 'skill' && (rule.onlyWhenMatched || (rule.targetScope && rule.targetScope !== 'any'))
        ? [rule.action.skillId]
        : [],
    ),
  );
  const fallbackCandidates = candidates.filter(
    (candidate) =>
      candidate.command.type !== 'summon' &&
      (candidate.command.type !== 'skill' || !scopedSkillIds.has(candidate.command.skillId)),
  );
  if (strategy.fallback === 'attack')
    return fallbackCandidates.find(candidate => candidate.command.type === 'attack') ??
      fallbackCandidates.find(candidate => candidate.command.type === 'defend');
  if (strategy.fallback === 'defend')
    return fallbackCandidates.find(candidate => candidate.command.type === 'defend') ??
      fallbackCandidates.find(candidate => candidate.command.type === 'attack');
  return fallbackCandidates[0];
}
