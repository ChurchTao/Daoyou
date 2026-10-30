import { db } from '@server/lib/drizzle/db.js';
import {
  mutateAutoStrategyBook,
  readAutoStrategyBook,
} from '@server/lib/repositories/combatV6AutoStrategyRepository.js';
import { autoStatusChoices } from '@daoyou/game-content/combat/auto-status-options';
import {
  type AutoStrategy,
  type AutoStrategyBook,
  type AutoStrategySlotIndex,
  activateStoredAutoStrategySlot,
  activeStoredAutoStrategy,
  preferDefaultAutoStrategy,
  removeAutoStrategySlot,
  saveAutoStrategySlot,
} from '@daoyou/game-domain/combat/auto';
import { defaultAutoStrategy } from '@daoyou/game-content/combat/auto-strategies';
import { COMBAT_V6_SECT_DEFINITIONS } from '@daoyou/game-content/sects';
import { projectCharacterToCombatV6 } from '@daoyou/game-rules/combat/projection';
import { assembleCombatV6TrainingPlayer } from '@server/combat/application/CombatV6BuildService.js';

export class AutoStrategyError extends Error {}

function emptySlots(): AutoStrategyBook['slots'] {
  return [null, null, null];
}

export async function readCombatAutoStrategy(cultivatorId: string) {
  const { player } = await assembleCombatV6TrainingPlayer(cultivatorId, db);
  const pathId = player.sect?.activePathId;
  if (!pathId) throw new AutoStrategyError('请先选择宗门流派');
  const definition = COMBAT_V6_SECT_DEFINITIONS[player.sect!.sectId];
  const path = definition.paths.find((entry) => entry.id === pathId);
  if (!path) throw new AutoStrategyError('当前流派无效');
  const projected = projectCharacterToCombatV6({
    ...player,
    side: 0,
    slot: 0,
    resourcePolicy: 'full',
  });
  if (!projected.ok) throw new AutoStrategyError('当前构筑无法编译');
  const skillById = new Map(projected.skills.map((skill) => [skill.id, skill]));
  const skillNames = Object.fromEntries(
    [
      ...definition.skills,
      ...(path.grantSkills ?? []),
      ...path.nodes.flatMap((node) => node.grantSkills ?? []),
    ].map(({ definition: skill }) => [skill.id, skill.name]),
  );
  const book = await readAutoStrategyBook(cultivatorId, pathId, db);
  return {
    pathId,
    pathName: path.name,
    defaultStrategy: defaultAutoStrategy(pathId) ?? {
      version: 1 as const,
      rules: [],
    },
    customStrategy: activeStoredAutoStrategy(book),
    slots: book?.slots ?? emptySlots(),
    activeSlot: book?.activeSlot ?? null,
    availableResources:
      projected.unit.resources?.map((resource) => ({
        id: resource.id,
        name: resource.name,
      })) ?? [],
    availableSkills: (projected.unit.skills ?? []).flatMap((id) => {
      const skill =
        projected.unit.skillOverrides?.find((entry) => entry.id === id) ??
        skillById.get(id);
      return skill ? [{ id, name: skill.name }] : [];
    }),
    skillNames,
  };
}

function skillIds(strategy: AutoStrategy | null | undefined) {
  return (
    strategy?.rules.flatMap((rule) =>
      rule.action.type === 'skill' ? [rule.action.skillId] : [],
    ) ?? []
  );
}

function withBook(
  view: Awaited<ReturnType<typeof readCombatAutoStrategy>>,
  book: AutoStrategyBook | null,
) {
  return {
    ...view,
    customStrategy: activeStoredAutoStrategy(book),
    slots: book?.slots ?? emptySlots(),
    activeSlot: book?.activeSlot ?? null,
  };
}

function assertCurrentPath(
  view: Awaited<ReturnType<typeof readCombatAutoStrategy>>,
  pathId: string,
) {
  if (view.pathId !== pathId)
    throw new AutoStrategyError('当前流派已变化，请刷新');
}

function assertStrategyAllowed(
  view: Awaited<ReturnType<typeof readCombatAutoStrategy>>,
  strategy: AutoStrategy,
) {
  const allowed = new Set([
    ...view.availableSkills.map((skill) => skill.id),
    ...skillIds(view.defaultStrategy),
    ...view.slots.flatMap((slot) => skillIds(slot)),
  ]);
  if (
    strategy.rules.some(
      (rule) =>
        rule.action.type === 'skill' && !allowed.has(rule.action.skillId),
    )
  )
    throw new AutoStrategyError('策略包含未掌握的技能');
  const resources = new Set(
    view.availableResources.map((resource) => resource.id),
  );
  if (
    strategy.rules.some((rule) =>
      rule.conditions.some(
        (condition) =>
          condition.type === 'selfResourceAtLeast' &&
          !resources.has(condition.resourceId),
      ),
    )
  )
    throw new AutoStrategyError('策略包含无效的战斗资源');
  const statusChoices = autoStatusChoices(view.pathId);
  if (
    strategy.rules.some((rule) =>
      rule.conditions.some((condition) => {
        if (condition.type === 'selfStatus')
          return !statusChoices.self.some(
            (choice) =>
              choice.kind === condition.kind &&
              choice.statusId === condition.statusId,
          );
        if (condition.type === 'targetStatus')
          return !statusChoices.target.some(
            (choice) =>
              choice.kind === condition.kind &&
              choice.statusId === condition.statusId &&
              choice.ownedBySelf === condition.ownedBySelf &&
              rule.action.type !== 'defend' &&
              (rule.action.type !== 'attack' || choice.side === 'enemy'),
          );
        return false;
      }),
    )
  )
    throw new AutoStrategyError('策略包含当前宗门不可用的状态');
}

export async function saveCombatAutoStrategy(
  cultivatorId: string,
  pathId: string,
  slot: AutoStrategySlotIndex | undefined,
  strategy: AutoStrategy,
) {
  const view = await readCombatAutoStrategy(cultivatorId);
  assertCurrentPath(view, pathId);
  assertStrategyAllowed(view, strategy);
  const target = slot ?? view.activeSlot ?? 0;
  const book = await mutateAutoStrategyBook(
    cultivatorId,
    pathId,
    (current) => saveAutoStrategySlot(current, target, strategy),
    db,
  );
  return withBook(view, book);
}

export async function activateCombatAutoStrategy(
  cultivatorId: string,
  pathId: string,
  slot: AutoStrategySlotIndex,
) {
  const view = await readCombatAutoStrategy(cultivatorId);
  assertCurrentPath(view, pathId);
  const book = await mutateAutoStrategyBook(
    cultivatorId,
    pathId,
    (current) => {
      const next = activateStoredAutoStrategySlot(current, slot);
      if (!next) throw new AutoStrategyError('这套战术还没保存');
      return next;
    },
    db,
  );
  return withBook(view, book);
}

export async function resetCombatAutoStrategy(
  cultivatorId: string,
  pathId: string,
) {
  const view = await readCombatAutoStrategy(cultivatorId);
  assertCurrentPath(view, pathId);
  const book = await mutateAutoStrategyBook(
    cultivatorId,
    pathId,
    preferDefaultAutoStrategy,
    db,
  );
  return withBook(view, book);
}

export async function removeCombatAutoStrategySlot(
  cultivatorId: string,
  pathId: string,
  slot: AutoStrategySlotIndex,
) {
  const view = await readCombatAutoStrategy(cultivatorId);
  assertCurrentPath(view, pathId);
  const book = await mutateAutoStrategyBook(
    cultivatorId,
    pathId,
    (current) => removeAutoStrategySlot(current, slot),
    db,
  );
  return withBook(view, book);
}
