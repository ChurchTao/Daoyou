import type {
  CultivatorSectState,
  SectDefinition,
  SectMeridianLayer,
  SectModule,
  SectPathDefinition,
} from './types';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';

const EXPECTED_LAYERS: SectMeridianLayer[] = [1, 2, 3, 4, 5, 'ultimate'];

function duplicateIds(values: readonly string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) return true;
    seen.add(value);
    return false;
  });
}

function assertPathDefinition(path: SectPathDefinition, module: SectModule): void {
  const nodeIds = path.nodes.map((node) => node.id);
  const duplicates = duplicateIds(nodeIds);
  if (duplicates.length) throw new Error(`流派 ${path.id} 存在重复节点: ${duplicates.join(', ')}`);

  for (const layer of EXPECTED_LAYERS) {
    const count = path.nodes.filter((node) => node.layer === layer).length;
    if (count !== 3) throw new Error(`流派 ${path.id} 的 ${String(layer)} 层必须恰有3个节点`);
  }

  const pathModule = module.paths[path.id];
  if (!pathModule) throw new Error(`流派 ${path.id} 未注册运行时模块`);
  const behaviors = new Set(pathModule.behaviorIds);
  if (behaviors.size !== pathModule.behaviorIds.length) {
    throw new Error(`流派 ${path.id} 存在重复节点行为`);
  }
  const missing = nodeIds.filter((id) => !behaviors.has(id));
  const orphan = pathModule.behaviorIds.filter((id) => !nodeIds.includes(id));
  if (missing.length || orphan.length) {
    throw new Error(`流派 ${path.id} 节点行为不完整: missing=${missing.join(',')} orphan=${orphan.join(',')}`);
  }

  if (!path.tactics.some((tactic) => tactic.id === path.defaultTacticId)) {
    throw new Error(`流派 ${path.id} 默认战术不存在`);
  }
}

export function assertSectModule(module: SectModule): void {
  const definition = module.definition;
  if (!definition.trial.name.trim() || !definition.trial.description.trim()) {
    throw new Error(`宗门 ${definition.id} 必须提供可展示的试炼定义`);
  }
  if (definition.methods.length !== 6) throw new Error(`宗门 ${definition.id} 必须定义6本基础心法`);
  const slots = definition.methods.map((method) => method.slot);
  if (new Set(slots).size !== 6) throw new Error(`宗门 ${definition.id} 的心法槽位必须为1至6且不重复`);

  const methodIds = definition.methods.map((method) => method.id);
  const abilityIds = definition.abilities.map((ability) => ability.id);
  if (duplicateIds(methodIds).length) throw new Error(`宗门 ${definition.id} 存在重复心法ID`);
  if (duplicateIds(abilityIds).length) throw new Error(`宗门 ${definition.id} 存在重复法术ID`);
  const methodSet = new Set(methodIds);
  const abilitySet = new Set(abilityIds);

  for (const method of definition.methods) {
    const ownedAbilities = definition.abilities.filter((ability) => ability.methodId === method.id);
    if (!ownedAbilities.length) throw new Error(`心法 ${method.id} 必须至少拥有一个基础法术`);
    for (const milestone of method.milestones) {
      if (milestone.abilityId && !abilitySet.has(milestone.abilityId)) {
        throw new Error(`心法 ${method.id} 引用了未知法术 ${milestone.abilityId}`);
      }
      for (const requiredId of Object.keys(milestone.requiredMethods ?? {})) {
        if (!methodSet.has(requiredId)) throw new Error(`里程碑 ${milestone.id} 引用了未知心法 ${requiredId}`);
      }
    }
  }
  for (const ability of definition.abilities) {
    if (!methodSet.has(ability.methodId)) throw new Error(`法术 ${ability.id} 引用了未知心法 ${ability.methodId}`);
  }

  const pathIds = definition.paths.map((path) => path.id);
  if (duplicateIds(pathIds).length) throw new Error(`宗门 ${definition.id} 存在重复流派ID`);
  for (const path of definition.paths) assertPathDefinition(path, module);
  for (const registeredId of Object.keys(module.paths)) {
    if (!pathIds.includes(registeredId)) throw new Error(`宗门 ${definition.id} 注册了未定义流派 ${registeredId}`);
  }

  for (const [methodId] of Object.entries(definition.onboarding.initialMethods)) {
    if (!methodSet.has(methodId)) throw new Error(`入宗配置引用未知心法 ${methodId}`);
  }
  for (const abilityId of definition.onboarding.initialAbilityLoadout) {
    if (abilityId && !abilitySet.has(abilityId)) throw new Error(`入宗配置引用未知法术 ${abilityId}`);
  }

  assertAbilityContracts(module);
}

function assertAbilityContracts(module: SectModule): void {
  const definition = module.definition;
  const methods = Object.fromEntries(definition.methods.map((method) => [method.id, 100]));
  const loadout = definition.abilities
    .filter((ability) => ability.occupiesActiveSlot)
    .slice(0, 4)
    .map((ability) => ability.id);
  const abilityLoadout = Array.from({ length: 4 }, (_, index) => loadout[index] ?? null) as [string | null, string | null, string | null, string | null];
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
    for (const node of path.nodes) {
      states.push({
        ...baseState,
        activePathId: path.id,
        paths: [{
          pathId: path.id,
          level: 100,
          tacticId: path.defaultTacticId,
          activeMeridianSlot: 1,
          meridianLoadouts: [
            { slot: 1, nodeIds: [node.id], version: 1 },
            { slot: 2, nodeIds: [], version: 1 },
            { slot: 3, nodeIds: [], version: 1 },
          ],
        }],
      });
    }
  }

  for (const sect of states) {
    const projection = module.projectCombat({ sect, realm: '渡劫' });
    if (!projection) throw new Error(`宗门 ${definition.id} 无法生成战斗投影`);
    if (projection.defaultAttack) AbilityFactory.create(projection.defaultAttack);
    for (const ability of projection.abilities) AbilityFactory.create(ability);
    for (const ability of definition.abilities) {
      AbilityFactory.create(module.resolveAbility({ sect, realm: '渡劫', abilityId: ability.id }).config);
    }
  }
}

export class SectRegistry {
  private readonly modules = new Map<string, SectModule>();

  constructor(modules: readonly SectModule[] = []) {
    for (const module of modules) this.register(module);
  }

  register(module: SectModule): void {
    assertSectModule(module);
    if (this.modules.has(module.definition.id)) throw new Error(`宗门重复注册: ${module.definition.id}`);
    this.modules.set(module.definition.id, module);
  }

  get(sectId: string): SectModule | undefined {
    return this.modules.get(sectId);
  }

  require(sectId: string): SectModule {
    const module = this.get(sectId);
    if (!module) throw new Error(`未知宗门: ${sectId}`);
    return module;
  }

  listDefinitions(): SectDefinition[] {
    return Array.from(this.modules.values(), (module) => module.definition);
  }

  validateState(state: CultivatorSectState): void {
    const module = this.require(state.sectId);
    if (state.configVersion !== module.definition.configVersion) {
      throw new Error(`宗门 ${state.sectId} 配置版本不兼容: ${state.configVersion}`);
    }
    const methodIds = new Set(module.definition.methods.map((method) => method.id));
    const abilityIds = new Set(module.definition.abilities.map((ability) => ability.id));
    for (const id of Object.keys(state.methods)) if (!methodIds.has(id)) throw new Error(`未知心法进度: ${id}`);
    for (const id of state.abilityLoadout) if (id && !abilityIds.has(id)) throw new Error(`未知宗门法术: ${id}`);
    if (new Set(state.paths.map((path) => path.pathId)).size !== state.paths.length) {
      throw new Error('流派进度不可重复');
    }
    for (const pathState of state.paths) {
      const path = module.definition.paths.find((candidate) => candidate.id === pathState.pathId);
      if (!path) throw new Error(`未知流派进度: ${pathState.pathId}`);
      const nodeIds = new Set(path.nodes.map((node) => node.id));
      const tacticIds = new Set(path.tactics.map((tactic) => tactic.id));
      if (!tacticIds.has(pathState.tacticId)) throw new Error(`未知流派战术: ${pathState.tacticId}`);
      const slots = pathState.meridianLoadouts.map((loadout) => loadout.slot).sort();
      if (slots.length !== 3 || slots.join(',') !== '1,2,3') {
        throw new Error(`流派 ${pathState.pathId} 必须保存三套唯一经脉方案`);
      }
      if (!slots.includes(pathState.activeMeridianSlot)) {
        throw new Error(`流派 ${pathState.pathId} 当前经脉方案不存在`);
      }
      for (const loadout of pathState.meridianLoadouts) {
        for (const nodeId of loadout.nodeIds) if (!nodeIds.has(nodeId)) throw new Error(`未知经脉节点: ${nodeId}`);
      }
    }
    if (state.activePathId && !state.paths.some((path) => path.pathId === state.activePathId)) {
      throw new Error(`激活流派尚未习得: ${state.activePathId}`);
    }
  }
}

export function createSectRegistry(modules: readonly SectModule[]): SectRegistry {
  return new SectRegistry(modules);
}
