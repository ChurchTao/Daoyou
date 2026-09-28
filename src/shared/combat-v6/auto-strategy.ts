import { z } from 'zod';
import defaults from './auto-defaults.json';
import type { AutoObservation } from './auto-observation';
import type { AutoCandidate } from './auto-utility';

const condition = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('selfHpBelow'),
    percent: z.number().int().min(1).max(100),
  }),
  z.strictObject({
    type: z.literal('allyHpBelow'),
    percent: z.number().int().min(1).max(100),
  }),
  z.strictObject({
    type: z.literal('enemyHpBelow'),
    percent: z.number().int().min(1).max(100),
  }),
  z.strictObject({ type: z.literal('allyDowned') }),
  z.strictObject({
    type: z.literal('enemyCountAtLeast'),
    count: z.number().int().min(2).max(6),
  }),
  z.strictObject({
    type: z.literal('selfResourceAtLeast'),
    resourceId: z.string().min(1).max(120),
    amount: z.number().int().min(1).max(10000),
  }),
  z.strictObject({
    type: z.literal('selfStatus'),
    kind: z.string().min(1).max(120),
    statusId: z.string().min(1).max(160).optional(),
    present: z.boolean(),
  }),
  z.strictObject({
    type: z.literal('targetStatus'),
    kind: z.string().min(1).max(120),
    statusId: z.string().min(1).max(160).optional(),
    present: z.boolean(),
    ownedBySelf: z.boolean(),
  }),
]);

export const AutoStrategySchema = z.strictObject({
  version: z.literal(1),
  rules: z
    .array(
      z.strictObject({
        conditions: z.array(condition).max(3),
        action: z.discriminatedUnion('type', [
          z.strictObject({
            type: z.literal('skill'),
            skillId: z.string().min(1).max(160),
          }),
          z.strictObject({ type: z.literal('attack') }),
          z.strictObject({ type: z.literal('defend') }),
        ]),
        target: z
          .enum(['best', 'lowestHpEnemy', 'lowestHpAlly'])
          .default('best'),
      }),
    )
    .max(12),
});
export type AutoStrategy = z.infer<typeof AutoStrategySchema>;
const DefaultStrategiesSchema = z.strictObject({
  version: z.literal(1),
  paths: z.record(z.string(), AutoStrategySchema),
});
export const DEFAULT_AUTO_STRATEGIES =
  DefaultStrategiesSchema.parse(defaults).paths;

export function defaultAutoStrategy(
  pathId: string | undefined,
): AutoStrategy | undefined {
  return pathId ? DEFAULT_AUTO_STRATEGIES[pathId] : undefined;
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
  for (const rule of strategy.rules) {
    const targetConditions = rule.conditions.filter(
      (condition) => condition.type === 'targetStatus',
    );
    const matches = rule.conditions.every((condition) => {
      switch (condition.type) {
        case 'selfHpBelow':
          return hpPercent(source) < condition.percent;
        case 'allyHpBelow':
          return allies.some(
            (unit) => standing(unit) && hpPercent(unit) < condition.percent,
          );
        case 'enemyHpBelow':
          return enemies.some(
            (unit) => standing(unit) && hpPercent(unit) < condition.percent,
          );
        case 'allyDowned':
          return allies.some((unit) => unit.flags.downed);
        case 'enemyCountAtLeast':
          return enemies.filter(standing).length >= condition.count;
        case 'selfResourceAtLeast':
          return (
            (source.resources.find(
              (resource) => resource.id === condition.resourceId,
            )?.current ?? 0) >= condition.amount
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
      const matchingTargets = targetConditions.length
        ? targetIds.filter((id) => {
            const target = observation.units.find((unit) => unit.id === id);
            return (
              target &&
              targetConditions.every(
                (condition) =>
                  target.statuses.some(
                    (status) =>
                      status.kind === condition.kind &&
                      (!condition.statusId ||
                        status.id === condition.statusId) &&
                      (!condition.ownedBySelf || status.sourceId === sourceId),
                  ) === condition.present,
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
  return candidates[0];
}
