import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { SectCompiler } from '../compiler';
import type {
  CultivatorSectState,
  SectDefinition,
  SectMeridianLayer,
  SectModule,
  SectPathDefinition,
} from '../types';

const EXPECTED_LAYERS: SectMeridianLayer[] = [1, 2, 3, 4, 5, 'ultimate'];

function duplicateIds(values: readonly string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) return true;
    seen.add(value);
    return false;
  });
}

function assertNonEmptyIds(label: string, values: readonly string[]): void {
  if (values.some((value) => !value.trim()))
    throw new Error(`${label} ID不能为空`);
}

function assertRequirementValues(
  label: string,
  requiredMethods: Record<string, number> | undefined,
): void {
  for (const [methodId, level] of Object.entries(requiredMethods ?? {})) {
    if (!methodId.trim() || !Number.isInteger(level) || level < 0) {
      throw new Error(`${label}心法前置无效: ${methodId}`);
    }
  }
}

function assertPathDefinition(
  path: SectPathDefinition,
  module: SectModule,
): void {
  const nodeIds = path.nodes.map((node) => node.id);
  assertNonEmptyIds(`流派 ${path.id} 节点`, nodeIds);
  const duplicates = duplicateIds(nodeIds);
  if (duplicates.length)
    throw new Error(`流派 ${path.id} 存在重复节点: ${duplicates.join(', ')}`);

  for (const layer of EXPECTED_LAYERS) {
    const count = path.nodes.filter((node) => node.layer === layer).length;
    if (count !== 3)
      throw new Error(`流派 ${path.id} 的 ${String(layer)} 层必须恰有3个节点`);
  }

  const pathModule = module.paths[path.id];
  if (!pathModule) throw new Error(`流派 ${path.id} 未注册运行时模块`);
  if (pathModule.definition !== path) {
    throw new Error(`流派 ${path.id} 定义与运行时模块不一致`);
  }
  const behaviorKeys = Object.keys(pathModule.nodeBehaviors);
  const behaviors = new Set(behaviorKeys);
  const missing = nodeIds.filter((id) => !behaviors.has(id));
  const orphan = behaviorKeys.filter((id) => !nodeIds.includes(id));
  if (missing.length || orphan.length) {
    throw new Error(
      `流派 ${path.id} 节点行为不完整: missing=${missing.join(',')} orphan=${orphan.join(',')}`,
    );
  }

  if (!path.tactics.some((tactic) => tactic.id === path.defaultTacticId)) {
    throw new Error(`流派 ${path.id} 默认战术不存在`);
  }
  if (duplicateIds(path.tactics.map((tactic) => tactic.id)).length) {
    throw new Error(`流派 ${path.id} 存在重复战术ID`);
  }
  assertNonEmptyIds(
    `流派 ${path.id} 战术`,
    path.tactics.map((tactic) => tactic.id),
  );
  for (const tactic of path.tactics) {
    const strategy = pathModule.createSelectionStrategy(tactic.id);
    if (!strategy || typeof strategy.select !== 'function')
      throw new Error(`流派 ${path.id} 战术 ${tactic.id} 未实现策略`);
  }
  const methodIds = new Set(
    module.definition.methods.map((method) => method.id),
  );
  for (const node of path.nodes) {
    if ((node.minRealm === undefined) !== (node.minRealmStage === undefined)) {
      throw new Error(`节点 ${node.id} 的境界前置必须同时提供境界和阶段`);
    }
    if (
      node.minPathLevel !== undefined &&
      (!Number.isInteger(node.minPathLevel) || node.minPathLevel < 0)
    ) {
      throw new Error(`节点 ${node.id} 的流派等级前置无效`);
    }
    assertRequirementValues(`节点 ${node.id} `, node.requiredMethods);
    for (const requiredId of Object.keys(node.requiredMethods ?? {})) {
      if (!methodIds.has(requiredId))
        throw new Error(`节点 ${node.id} 引用了未知心法 ${requiredId}`);
    }
  }
}

export function assertSectModule(module: SectModule): void {
  const definition = module.definition;
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
  if (definition.methods.length !== 6)
    throw new Error(`宗门 ${definition.id} 必须定义6本基础心法`);
  const slots = definition.methods
    .map((method) => method.slot)
    .sort((a, b) => a - b);
  if (slots.join(',') !== '1,2,3,4,5,6')
    throw new Error(`宗门 ${definition.id} 的心法槽位必须为1至6且不重复`);

  const methodIds = definition.methods.map((method) => method.id);
  const abilityIds = definition.abilities.map((ability) => ability.id);
  const milestoneIds = definition.methods.flatMap((method) =>
    method.milestones.map((milestone) => milestone.id),
  );
  assertNonEmptyIds(`宗门 ${definition.id} 心法`, methodIds);
  assertNonEmptyIds(`宗门 ${definition.id} 法术`, abilityIds);
  assertNonEmptyIds(`宗门 ${definition.id} 里程碑`, milestoneIds);
  if (duplicateIds(methodIds).length)
    throw new Error(`宗门 ${definition.id} 存在重复心法ID`);
  if (duplicateIds(abilityIds).length)
    throw new Error(`宗门 ${definition.id} 存在重复法术ID`);
  if (duplicateIds(milestoneIds).length)
    throw new Error(`宗门 ${definition.id} 存在重复里程碑ID`);
  const methodSet = new Set(methodIds);
  const abilitySet = new Set(abilityIds);

  for (const method of definition.methods) {
    const ownedAbilities = definition.abilities.filter(
      (ability) => ability.methodId === method.id,
    );
    if (!ownedAbilities.length)
      throw new Error(`心法 ${method.id} 必须至少拥有一个基础法术`);
    for (const milestone of method.milestones) {
      if (!Number.isInteger(milestone.level) || milestone.level < 0)
        throw new Error(`里程碑 ${milestone.id} 等级无效`);
      if (
        (milestone.minRealm === undefined) !==
        (milestone.minRealmStage === undefined)
      ) {
        throw new Error(
          `里程碑 ${milestone.id} 的境界前置必须同时提供境界和阶段`,
        );
      }
      assertRequirementValues(
        `里程碑 ${milestone.id} `,
        milestone.requiredMethods,
      );
      if (milestone.abilityId && !abilitySet.has(milestone.abilityId)) {
        throw new Error(
          `心法 ${method.id} 引用了未知法术 ${milestone.abilityId}`,
        );
      }
      for (const requiredId of Object.keys(milestone.requiredMethods ?? {})) {
        if (!methodSet.has(requiredId))
          throw new Error(
            `里程碑 ${milestone.id} 引用了未知心法 ${requiredId}`,
          );
      }
    }
  }
  for (const ability of definition.abilities) {
    if (!methodSet.has(ability.methodId))
      throw new Error(`法术 ${ability.id} 引用了未知心法 ${ability.methodId}`);
    if (!Number.isInteger(ability.unlockLevel) || ability.unlockLevel < 0)
      throw new Error(`法术 ${ability.id} 解锁等级无效`);
  }

  const pathIds = definition.paths.map((path) => path.id);
  if (duplicateIds(pathIds).length)
    throw new Error(`宗门 ${definition.id} 存在重复流派ID`);
  const allNodeIds = definition.paths.flatMap((path) =>
    path.nodes.map((node) => node.id),
  );
  if (duplicateIds(allNodeIds).length)
    throw new Error(`宗门 ${definition.id} 存在跨流派重复节点ID`);
  const allTacticIds = definition.paths.flatMap((path) =>
    path.tactics.map((tactic) => tactic.id),
  );
  if (duplicateIds(allTacticIds).length)
    throw new Error(`宗门 ${definition.id} 存在跨流派重复战术ID`);
  for (const path of definition.paths) assertPathDefinition(path, module);
  for (const registeredId of Object.keys(module.paths)) {
    if (!pathIds.includes(registeredId))
      throw new Error(`宗门 ${definition.id} 注册了未定义流派 ${registeredId}`);
  }

  for (const [methodId] of Object.entries(
    definition.onboarding.initialMethods,
  )) {
    if (!methodSet.has(methodId))
      throw new Error(`入宗配置引用未知心法 ${methodId}`);
  }
  if (
    !Number.isInteger(definition.onboarding.initialContribution) ||
    definition.onboarding.initialContribution < 0
  ) {
    throw new Error(`宗门 ${definition.id} 入宗贡献无效`);
  }
  for (const abilityId of definition.onboarding.initialAbilityLoadout) {
    if (abilityId && !abilitySet.has(abilityId))
      throw new Error(`入宗配置引用未知法术 ${abilityId}`);
  }
  assertPresetLoadout(
    '入宗配置',
    definition.onboarding.initialMethods,
    definition.onboarding.initialAbilityLoadout,
    definition,
  );

  assertAbilityContracts(module);
}

function assertPresetLoadout(
  label: string,
  methods: Record<string, number>,
  loadout: [string | null, string | null, string | null, string | null],
  definition: SectDefinition,
): void {
  for (const [methodId, level] of Object.entries(methods)) {
    if (!definition.methods.some((method) => method.id === methodId))
      throw new Error(`${label}引用未知心法 ${methodId}`);
    if (!Number.isInteger(level) || level < 0)
      throw new Error(`${label}心法等级无效: ${methodId}`);
  }
  const ids = loadout.filter((id): id is string => id !== null);
  if (new Set(ids).size !== ids.length) throw new Error(`${label}神通不可重复`);
  for (const id of ids) {
    const ability = definition.abilities.find((entry) => entry.id === id);
    if (!ability?.occupiesActiveSlot)
      throw new Error(`${label}包含非主动槽法术 ${id}`);
    if ((methods[ability.methodId] ?? 0) < ability.unlockLevel)
      throw new Error(`${label}包含未解锁法术 ${id}`);
  }
}

function assertAbilityContracts(module: SectModule): void {
  const compiler = new SectCompiler();
  const definition = module.definition;
  const methods = Object.fromEntries(
    definition.methods.map((method) => [method.id, 100]),
  );
  const loadout = definition.abilities
    .filter((ability) => ability.occupiesActiveSlot)
    .slice(0, 4)
    .map((ability) => ability.id);
  const abilityLoadout = Array.from(
    { length: 4 },
    (_, index) => loadout[index] ?? null,
  ) as [string | null, string | null, string | null, string | null];
  const baseState: CultivatorSectState = {
    membershipId: `registry-validation:${definition.id}`,
    sectId: definition.id,
    status: 'active',
    contribution: 0,
    configVersion: definition.configVersion,
    methods,
    paths: [],
    abilityLoadout,
  };
  const states: CultivatorSectState[] = [baseState];
  for (const path of definition.paths) {
    const pathBase: CultivatorSectState = {
      ...baseState,
      activePathId: path.id,
      paths: [
        {
          pathId: path.id,
          level: 100,
          tacticId: path.defaultTacticId,
          activeMeridianSlot: 1,
          meridianLoadouts: [
            { slot: 1, nodeIds: [], version: 1 },
            { slot: 2, nodeIds: [], version: 1 },
            { slot: 3, nodeIds: [], version: 1 },
          ],
        },
      ],
    };
    const baseline = JSON.stringify(
      compiler.compile(module, { sect: pathBase, realm: '渡劫' }),
    );
    states.push(pathBase);
    for (const node of path.nodes) {
      const nodeState = structuredClone(pathBase);
      const nodePathState = nodeState.paths.find(
        (entry) => entry.pathId === path.id,
      )!;
      nodePathState.meridianLoadouts.find(
        (entry) => entry.slot === 1,
      )!.nodeIds = [node.id];
      const compiled = compiler.compile(module, {
        sect: nodeState,
        realm: '渡劫',
      });
      if (JSON.stringify(compiled) === baseline)
        throw new Error(`节点 ${node.id} 的运行时行为为空`);
      states.push(nodeState);
    }
    const representativeState = structuredClone(pathBase);
    const representativePathState = representativeState.paths.find(
      (entry) => entry.pathId === path.id,
    )!;
    representativePathState.meridianLoadouts.find(
      (entry) => entry.slot === 1,
    )!.nodeIds = path.nodes.map((node) => node.id);
    states.push(representativeState);
  }

  for (const sect of states) {
    const projection = compiler.projectCombat(module, { sect, realm: '渡劫' });
    if (!projection) throw new Error(`宗门 ${definition.id} 无法生成战斗投影`);
    if (projection.defaultAttack)
      AbilityFactory.create(projection.defaultAttack);
    for (const ability of projection.abilities) AbilityFactory.create(ability);
    for (const ability of definition.abilities) {
      AbilityFactory.create(
        compiler.resolveAbility(module, {
          sect,
          realm: '渡劫',
          abilityId: ability.id,
        }).config,
      );
    }
  }
}
