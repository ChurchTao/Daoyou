import { type AutoStrategy, type AutoComparison } from '@daoyou/game-domain/combat/auto';







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
    condition.type === 'enemyHpBelow'
    ? 'lt'
    : 'gte';
}



function compareNumber(value: number, threshold: number, by: AutoComparison) {
  switch (by) {
    case 'lt':
      return value < threshold;
    case 'lte':
      return value <= threshold;
    case 'gt':
      return value > threshold;
    case 'gte':
      return value >= threshold;
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
): AutoCandidate | undefined {
  const source = observation.units.find((unit) => unit.id === sourceId);
  if (!source || !strategy) return candidates[0];
  const allies = observation.units.filter((unit) => unit.side === source.side);
  const enemies = observation.units.filter((unit) => unit.side !== source.side);
  const hpPercent = (unit: typeof source) =>
    (100 * unit.attrs.hp) / Math.max(1, unit.attrs.maxHp);
  const matchesStatus = (
    unit: typeof source,
    condition: Extract<
      AutoStrategy['rules'][number]['conditions'][number],
      { type: 'targetStatus' | 'allyStatus' }
    >,
  ) =>
    unit.statuses.some(
      (status) =>
        status.kind === condition.kind &&
        (!condition.statusId || status.id === condition.statusId) &&
        (!condition.ownedBySelf || status.sourceId === sourceId),
    );
  for (const rule of strategy.rules) {
    const targetConditions = rule.conditions.filter(
      (condition) =>
        condition.type === 'targetStatus' || condition.type === 'targetHpBelow',
    );
    const matches = rule.conditions.every((condition) => {
      switch (condition.type) {
        case 'selfHpBelow':
          return compareNumber(
            hpPercent(source),
            condition.percent,
            autoComparison(condition),
          );
        case 'allyHpBelow':
          return allies.some(
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
          return (
            source.statuses.some(
              (status) =>
                status.kind === condition.kind &&
                (!condition.statusId || status.id === condition.statusId),
            ) === condition.present
          );
        case 'targetStatus':
        case 'targetHpBelow':
          return true;
      }
    });
    if (!matches) continue;
    const eligible = candidates.flatMap((candidate) => {
      const command = candidate.command;
      if (!(
        command.type === rule.action.type &&
        (command.type !== 'skill' ||
          (rule.action.type === 'skill' &&
            command.skillId === rule.action.skillId))
      ))
        return [];
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
    if (rule.target === 'best') return eligible[0].candidate;
    const desiredSide =
      rule.target === 'lowestHpAlly' ? source.side : 1 - source.side;
    const target = observation.units
      .filter(
        (unit) =>
          unit.side === desiredSide &&
          standing(unit) &&
          (!targetConditions.length ||
            eligible.some(({ matchingTargets }) =>
              matchingTargets.includes(unit.id),
            )),
      )
      .sort((a, b) => hpPercent(a) - hpPercent(b) || a.slot - b.slot)[0];
    const targeted = eligible.find(({ matchingTargets }) =>
      matchingTargets.includes(target?.id ?? ''),
    );
    if (targeted) return targeted.candidate;
  }
  const scopedSkillIds = new Set(
    strategy.rules.flatMap((rule) =>
      rule.action.type === 'skill' && rule.targetScope && rule.targetScope !== 'any'
        ? [rule.action.skillId]
        : [],
    ),
  );
  return candidates.find(
    (candidate) =>
      candidate.command.type !== 'skill' ||
      !scopedSkillIds.has(candidate.command.skillId),
  );
}
