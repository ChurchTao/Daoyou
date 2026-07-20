import { StandardSectRules, type CultivatorSectState } from '../domain';
import type { SectModule } from '../plugin';
import { isAbilityUnlocked } from '../progression';

/** 持久化水合与运行时入口共用的结构校验器。 */
export class SectStateValidator {
  validate(module: SectModule, state: CultivatorSectState): void {
    if (!state.membershipId?.trim()) throw new Error('宗门成员ID不能为空');
    if (state.status !== 'prospect' && state.status !== 'active')
      throw new Error(`宗门成员状态无效: ${String(state.status)}`);
    if (!Number.isInteger(state.contribution) || state.contribution < 0)
      throw new Error('宗门贡献必须为非负整数');
    if (state.configVersion !== module.definition.configVersion) {
      throw new Error(
        `宗门 ${state.sectId} 配置版本不兼容: ${state.configVersion}`,
      );
    }
    const methodIds = new Set(
      module.definition.methods.map((method) => method.id),
    );
    const abilityIds = new Set(
      module.definition.abilities.map((ability) => ability.id),
    );
    if (!state.methods || typeof state.methods !== 'object')
      throw new Error('宗门心法进度结构无效');
    for (const [id, level] of Object.entries(state.methods)) {
      if (!methodIds.has(id)) throw new Error(`未知心法进度: ${id}`);
      if (typeof level !== 'number' || !Number.isInteger(level) || level < 0)
        throw new Error(`心法等级无效: ${id}`);
    }
    if (
      !Array.isArray(state.abilityLoadout) ||
      state.abilityLoadout.length !== StandardSectRules.activeAbilitySlotCount
    )
      throw new Error(
        `宗门神通栏必须包含${StandardSectRules.activeAbilitySlotCount}个固定槽位`,
      );
    const loadoutIds = state.abilityLoadout.filter(
      (id): id is string => id !== null,
    );
    if (new Set(loadoutIds).size !== loadoutIds.length)
      throw new Error('宗门神通栏不可重复装配');
    for (const id of loadoutIds) {
      if (!abilityIds.has(id)) throw new Error(`未知宗门法术: ${id}`);
      const ability = module.definition.abilities.find(
        (entry) => entry.id === id,
      );
      if (ability?.kind !== 'active')
        throw new Error(`非主动法术不可装配: ${id}`);
      if (!isAbilityUnlocked(module.definition, id, state))
        throw new Error(`未解锁宗门法术不可装配: ${id}`);
    }
    if (!Array.isArray(state.paths)) throw new Error('宗门流派进度结构无效');
    if (
      new Set(state.paths.map((path) => path.pathId)).size !==
      state.paths.length
    ) {
      throw new Error('流派进度不可重复');
    }
    for (const pathState of state.paths) {
      const path = module.definition.paths.find(
        (candidate) => candidate.id === pathState.pathId,
      );
      if (!path) throw new Error(`未知流派进度: ${pathState.pathId}`);
      if (!Array.isArray(pathState.unlockedLayerIds))
        throw new Error(`流派 ${pathState.pathId} 解锁层级结构无效`);
      if (
        new Set(pathState.unlockedLayerIds).size !==
        pathState.unlockedLayerIds.length
      )
        throw new Error(`流派 ${pathState.pathId} 解锁层级不可重复`);
      const orderedLayerIds = [...path.layers]
        .sort((left, right) => left.order - right.order)
        .map((layer) => layer.id);
      const expectedPrefix = orderedLayerIds.slice(
        0,
        pathState.unlockedLayerIds.length,
      );
      if (expectedPrefix.join(',') !== pathState.unlockedLayerIds.join(','))
        throw new Error(`流派 ${pathState.pathId} 层级必须按顺序解锁`);
      if (
        !StandardSectRules.meridianLoadoutSlots.includes(
          pathState.activeMeridianSlot,
        )
      )
        throw new Error(`流派 ${pathState.pathId} 当前参悟方案槽无效`);
      const nodeIds = new Set(path.nodes.map((node) => node.id));
      const unlockedLayerIds = new Set(pathState.unlockedLayerIds);
      const tacticIds = new Set(path.tactics.map((tactic) => tactic.id));
      if (!tacticIds.has(pathState.tacticId))
        throw new Error(`未知流派战术: ${pathState.tacticId}`);
      const slots = pathState.meridianLoadouts
        .map((loadout) => loadout.slot)
        .sort();
      if (
        slots.length !== StandardSectRules.meridianLoadoutSlots.length ||
        slots.join(',') !== StandardSectRules.meridianLoadoutSlots.join(',')
      ) {
        throw new Error(
          `流派 ${pathState.pathId} 必须保存${StandardSectRules.meridianLoadoutSlots.length}套唯一参悟方案`,
        );
      }
      if (!slots.includes(pathState.activeMeridianSlot)) {
        throw new Error(`流派 ${pathState.pathId} 当前参悟方案不存在`);
      }
      for (const loadout of pathState.meridianLoadouts) {
        if (!Number.isInteger(loadout.version) || loadout.version < 1)
          throw new Error('参悟方案版本必须为正整数');
        if (new Set(loadout.nodeIds).size !== loadout.nodeIds.length)
          throw new Error('参悟节点不可重复');
        const occupiedLayers = new Set<string>();
        for (const nodeId of loadout.nodeIds) {
          if (!nodeIds.has(nodeId)) throw new Error(`未知参悟节点: ${nodeId}`);
          const node = path.nodes.find((entry) => entry.id === nodeId)!;
          const layer = node.layerId;
          if (occupiedLayers.has(layer))
            throw new Error(`参悟第${layer}层只能选择一个节点`);
          occupiedLayers.add(layer);
          if (!unlockedLayerIds.has(node.layerId))
            throw new Error(`${node.name}所属层级尚未解锁`);
          for (const [methodId, level] of Object.entries(
            node.requiredMethods ?? {},
          )) {
            if ((state.methods[methodId] ?? 0) < level)
              throw new Error(`${node.name}尚未达到心法要求`);
          }
        }
      }
    }
    if (
      state.activePathId &&
      !state.paths.some((path) => path.pathId === state.activePathId)
    ) {
      throw new Error(`激活流派尚未习得: ${state.activePathId}`);
    }
  }
}
