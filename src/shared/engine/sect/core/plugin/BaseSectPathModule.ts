import type { AbilitySelectionStrategy } from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import type { SectBuildBuilder } from '../compilation';
import type {
  SectPathCompileContext,
  SectPathDefinition,
  SectPathDefinitionWithoutNodes,
  SectTacticId,
} from '../domain';
import type { SectNodePlugin, SectPathModule } from './contracts';

/**
 * 流派模板方法：定义、节点索引和运行时入口在构造时一次成型。
 * 子类只实现基础变体和战术策略，不参与节点分派。
 */
export abstract class BaseSectPathModule implements SectPathModule {
  readonly definition: SectPathDefinition;
  readonly nodes: ReadonlyMap<string, SectNodePlugin>;

  protected constructor(
    definition: SectPathDefinitionWithoutNodes,
    nodePlugins: readonly SectNodePlugin[],
  ) {
    this.nodes = new Map(
      nodePlugins.map((plugin) => [plugin.definition.id, plugin]),
    );
    this.definition = {
      ...definition,
      nodes: nodePlugins.map((plugin) => plugin.definition),
    };
  }

  compile(
    context: SectPathCompileContext,
    builder: SectBuildBuilder,
  ): void {
    this.initializeBuild(context, builder);
    const selected = new Set(
      context.path.meridianLoadouts.find(
        (loadout) => loadout.slot === context.path.activeMeridianSlot,
      )?.nodeIds ?? [],
    );
    const unlocked = new Set(context.path.unlockedLayerIds);
    const layerOrder = new Map(
      this.definition.layers.map((layer) => [layer.id, layer.order]),
    );
    const orderedNodes = this.definition.nodes
      .filter((node) => selected.has(node.id) && unlocked.has(node.layerId))
      .sort(
        (left, right) =>
          (layerOrder.get(left.layerId) ?? 99) -
          (layerOrder.get(right.layerId) ?? 99),
      );
    const applied = new Set<string>();
    for (const definition of orderedNodes) {
      const plugin = this.nodes.get(definition.id);
      if (!plugin) throw new Error(`参悟节点 ${definition.id} 缺少运行时插件`);
      applied.add(definition.id);
      plugin.apply(
        { ...context, activeNodeIds: new Set(applied) },
        builder,
      );
    }
    this.finalizeBuild(context, builder);
  }

  protected abstract initializeBuild(
    context: SectPathCompileContext,
    builder: SectBuildBuilder,
  ): void;

  protected finalizeBuild(
    _context: SectPathCompileContext,
    _builder: SectBuildBuilder,
  ): void {
    void _context;
    void _builder;
  }

  abstract createSelectionStrategy(
    tacticId: SectTacticId,
  ): AbilitySelectionStrategy;
}
