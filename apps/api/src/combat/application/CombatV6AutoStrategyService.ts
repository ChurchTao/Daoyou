import { db } from '@server/lib/drizzle/db.js';
import {
  readCustomAutoStrategy,
  removeCustomAutoStrategy,
  saveCustomAutoStrategy,
} from '@server/lib/repositories/combatV6AutoStrategyRepository.js';
import { autoStatusChoices } from '@daoyou/shared/combat-v6/auto-status-options';
import {
  defaultAutoStrategy,
  type AutoStrategy,
} from '@daoyou/shared/combat-v6/auto-strategy';
import { COMBAT_V6_SECT_DEFINITIONS } from '@daoyou/shared/engine/combat-v6/content';
import { projectCharacterToCombatV6 } from '@daoyou/shared/engine/combat-v6/projection';
import { assembleCombatV6TrainingPlayer } from '@server/combat/application/CombatV6BuildService.js';

export class AutoStrategyError extends Error {}

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
  const custom = await readCustomAutoStrategy(cultivatorId, pathId, db);
  return {
    pathId,
    pathName: path.name,
    defaultStrategy: defaultAutoStrategy(pathId) ?? {
      version: 1 as const,
      rules: [],
    },
    customStrategy: custom,
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

export async function saveCombatAutoStrategy(
  cultivatorId: string,
  pathId: string,
  strategy: AutoStrategy,
) {
  const view = await readCombatAutoStrategy(cultivatorId);
  if (view.pathId !== pathId)
    throw new AutoStrategyError('当前流派已变化，请刷新');
  const allowed = new Set([
    ...view.availableSkills.map((skill) => skill.id),
    ...view.defaultStrategy.rules.flatMap((rule) =>
      rule.action.type === 'skill' ? [rule.action.skillId] : [],
    ),
    ...(view.customStrategy?.rules.flatMap((rule) =>
      rule.action.type === 'skill' ? [rule.action.skillId] : [],
    ) ?? []),
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
  const statusChoices = autoStatusChoices(pathId);
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
  await saveCustomAutoStrategy(cultivatorId, pathId, strategy, db);
  return { ...view, customStrategy: strategy };
}

export async function resetCombatAutoStrategy(
  cultivatorId: string,
  pathId: string,
) {
  const view = await readCombatAutoStrategy(cultivatorId);
  if (view.pathId !== pathId)
    throw new AutoStrategyError('当前流派已变化，请刷新');
  await removeCustomAutoStrategy(cultivatorId, pathId, db);
  return { ...view, customStrategy: null };
}
