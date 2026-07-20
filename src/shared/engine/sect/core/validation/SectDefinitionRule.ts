import { getRealmStageRank } from '@shared/config/realmProgression';
import {
  StandardSectRules,
  sectAbilityMethodId,
  type SectDefinition,
  type SectPathDefinition,
} from '../domain';
import type { SectModule } from '../plugin';
import type { ValidationRule } from './ValidationPipeline';

function duplicateIds(values: readonly string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) return true;
    seen.add(value);
    return false;
  });
}

function assertNonEmptyIds(label: string, values: readonly string[]): void {
  if (values.some((value) => !value.trim())) {
    throw new Error(`${label} ID不能为空`);
  }
}

function assertRequirements(
  label: string,
  requiredMethods: Record<string, number> | undefined,
): void {
  for (const [methodId, level] of Object.entries(requiredMethods ?? {})) {
    if (!methodId.trim() || !Number.isInteger(level) || level < 0) {
      throw new Error(`${label}心法前置无效: ${methodId}`);
    }
  }
}

function validatePath(path: SectPathDefinition, definition: SectDefinition) {
  if (!path.minRealm || !path.minRealmStage) {
    throw new Error(`流派 ${path.id} 必须声明境界门槛`);
  }
  if (!path.layers.length) throw new Error(`流派 ${path.id} 必须至少定义一层`);
  const layerIds = path.layers.map((layer) => layer.id);
  assertNonEmptyIds(`流派 ${path.id} 层级`, layerIds);
  if (duplicateIds(layerIds).length)
    throw new Error(`流派 ${path.id} 存在重复层级ID`);
  const orders = path.layers.map((layer) => layer.order).sort((a, b) => a - b);
  if (orders.some((order, index) => order !== index + 1))
    throw new Error(`流派 ${path.id} 层级顺序必须从1连续递增`);
  const layerSet = new Set(layerIds);
  for (const layer of path.layers) {
    if (!layer.label.trim())
      throw new Error(`流派 ${path.id} 层级名称不能为空`);
    if (
      (layer.minRealm === undefined) !==
      (layer.minRealmStage === undefined)
    ) {
      throw new Error(`层级 ${layer.id} 的境界前置必须同时提供境界和阶段`);
    }
    if (
      layer.minRealm &&
      layer.minRealmStage &&
      getRealmStageRank(layer.minRealm, layer.minRealmStage) <
        getRealmStageRank(path.minRealm, path.minRealmStage)
    ) {
      throw new Error(`层级 ${layer.id} 不得早于所属流派境界门槛`);
    }
    assertRequirements(`层级 ${layer.id} `, layer.requiredMethods);
    for (const value of Object.values(layer.cost)) {
      if (!Number.isInteger(value) || value < 0)
        throw new Error(`层级 ${layer.id} 的解锁费用无效`);
    }
  }
  const nodeIds = path.nodes.map((node) => node.id);
  assertNonEmptyIds(`流派 ${path.id} 节点`, nodeIds);
  const duplicates = duplicateIds(nodeIds);
  if (duplicates.length) {
    throw new Error(`流派 ${path.id} 存在重复节点: ${duplicates.join(', ')}`);
  }
  for (const layerId of layerIds) {
    if (!path.nodes.some((node) => node.layerId === layerId))
      throw new Error(`流派 ${path.id} 的层级 ${layerId} 没有节点`);
  }
  if (!path.tactics.some((tactic) => tactic.id === path.defaultTacticId)) {
    throw new Error(`流派 ${path.id} 默认战术不存在`);
  }
  const tacticIds = path.tactics.map((tactic) => tactic.id);
  assertNonEmptyIds(`流派 ${path.id} 战术`, tacticIds);
  if (duplicateIds(tacticIds).length) {
    throw new Error(`流派 ${path.id} 存在重复战术ID`);
  }
  const methodIds = new Set(definition.methods.map((method) => method.id));
  for (const layer of path.layers) {
    for (const requiredId of Object.keys(layer.requiredMethods ?? {})) {
      if (!methodIds.has(requiredId))
        throw new Error(`层级 ${layer.id} 引用了未知心法 ${requiredId}`);
    }
  }
  for (const node of path.nodes) {
    if (!layerSet.has(node.layerId))
      throw new Error(`节点 ${node.id} 引用了未知层级 ${node.layerId}`);
    assertRequirements(`节点 ${node.id} `, node.requiredMethods);
    for (const requiredId of Object.keys(node.requiredMethods ?? {})) {
      if (!methodIds.has(requiredId)) {
        throw new Error(`节点 ${node.id} 引用了未知心法 ${requiredId}`);
      }
    }
  }
}

/** 只校验可序列化定义，不接触运行时实现。 */
export class SectDefinitionRule implements ValidationRule<SectModule> {
  validate(module: SectModule): void {
    const definition = module.definition;
    if (
      !definition.combatResource.id.trim() ||
      !definition.combatResource.name.trim() ||
      (definition.combatResource.icon !== undefined &&
        !definition.combatResource.icon.trim()) ||
      !Number.isInteger(definition.combatResource.max) ||
      definition.combatResource.max <= 0
    ) {
      throw new Error(`宗门 ${definition.id} 必须声明有效且唯一的战斗资源`);
    }
    if (!definition.id.trim()) throw new Error('宗门ID不能为空');
    if (
      !Number.isInteger(definition.configVersion) ||
      definition.configVersion < 1
    ) {
      throw new Error(`宗门 ${definition.id} 配置版本必须为正整数`);
    }
    if (!definition.raceIds.length || duplicateIds(definition.raceIds).length) {
      throw new Error(`宗门 ${definition.id} 的准入种族必须存在且唯一`);
    }
    if (!definition.trial.name.trim() || !definition.trial.description.trim()) {
      throw new Error(`宗门 ${definition.id} 必须提供可展示的试炼定义`);
    }
    if (definition.methods.length !== StandardSectRules.methodCount) {
      throw new Error(`宗门 ${definition.id} 必须定义${StandardSectRules.methodCount}本基础心法`);
    }
    const slots = definition.methods
      .map((method) => method.slot)
      .sort((a, b) => a - b);
    if (slots.join(',') !== StandardSectRules.methodSlots.join(',')) {
      throw new Error(`宗门 ${definition.id} 的心法槽位必须为1至6且不重复`);
    }

    const methodIds = definition.methods.map((method) => method.id);
    const abilityIds = definition.abilities.map((ability) => ability.id);
    assertNonEmptyIds(`宗门 ${definition.id} 心法`, methodIds);
    assertNonEmptyIds(`宗门 ${definition.id} 法术`, abilityIds);
    if (duplicateIds(methodIds).length)
      throw new Error(`宗门 ${definition.id} 存在重复心法ID`);
    if (duplicateIds(abilityIds).length)
      throw new Error(`宗门 ${definition.id} 存在重复法术ID`);
    const methodSet = new Set(methodIds);
    if (definition.methods.filter((method) => method.isPrimary).length !== 1) {
      throw new Error(`宗门 ${definition.id} 必须且只能声明一本主心法`);
    }
    if (definition.abilities.filter((ability) => ability.kind === 'default').length !== 1) {
      throw new Error(`宗门 ${definition.id} 必须且只能声明一个默认能力`);
    }

    for (const method of definition.methods) {
      if (
        !definition.abilities.some((ability) => sectAbilityMethodId(ability) === method.id)
      ) {
        throw new Error(`心法 ${method.id} 必须至少拥有一个基础法术`);
      }
    }
    for (const ability of definition.abilities) {
      if (ability.unlock.type === 'method') {
        if (!methodSet.has(ability.unlock.methodId)) {
          throw new Error(`法术 ${ability.id} 引用了未知心法 ${ability.unlock.methodId}`);
        }
        if (!Number.isInteger(ability.unlock.level) || ability.unlock.level < 0) {
          throw new Error(`法术 ${ability.id} 解锁等级无效`);
        }
      }
    }

    const pathIds = definition.paths.map((path) => path.id);
    const allNodeIds = definition.paths.flatMap((path) =>
      path.nodes.map((node) => node.id),
    );
    const allTacticIds = definition.paths.flatMap((path) =>
      path.tactics.map((tactic) => tactic.id),
    );
    if (duplicateIds(pathIds).length)
      throw new Error(`宗门 ${definition.id} 存在重复流派ID`);
    if (duplicateIds(allNodeIds).length)
      throw new Error(`宗门 ${definition.id} 存在跨流派重复节点ID`);
    if (duplicateIds(allTacticIds).length)
      throw new Error(`宗门 ${definition.id} 存在跨流派重复战术ID`);
    for (const path of definition.paths) validatePath(path, definition);
    const pathSet = new Set(pathIds);
    for (const ability of definition.abilities) {
      if (
        ability.unlock.type === 'active_path' &&
        !pathSet.has(ability.unlock.pathId)
      ) {
        throw new Error(`法术 ${ability.id} 引用了未知流派 ${ability.unlock.pathId}`);
      }
    }

    for (const [methodId, level] of Object.entries(
      definition.onboarding.initialMethods,
    )) {
      if (!methodSet.has(methodId))
        throw new Error(`入宗配置引用未知心法 ${methodId}`);
      if (!Number.isInteger(level) || level < 0)
        throw new Error(`入宗配置心法等级无效: ${methodId}`);
    }
    if (
      !Number.isInteger(definition.onboarding.initialContribution) ||
      definition.onboarding.initialContribution < 0
    ) {
      throw new Error(`宗门 ${definition.id} 入宗贡献无效`);
    }
    const loadoutIds = definition.onboarding.initialAbilityLoadout.filter(
      (id): id is string => id !== null,
    );
    if (new Set(loadoutIds).size !== loadoutIds.length)
      throw new Error('入宗配置神通不可重复');
    for (const abilityId of loadoutIds) {
      const ability = definition.abilities.find(
        (entry) => entry.id === abilityId,
      );
      if (!ability) throw new Error(`入宗配置引用未知法术 ${abilityId}`);
      if (ability.kind !== 'active')
        throw new Error(`入宗配置包含非主动槽法术 ${abilityId}`);
      if (ability.unlock.type === 'method' &&
        (definition.onboarding.initialMethods[ability.unlock.methodId] ?? 0) <
          ability.unlock.level) {
        throw new Error(`入宗配置包含未解锁法术 ${abilityId}`);
      }
    }
  }
}
